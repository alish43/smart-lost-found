import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('LostFoundItems')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
}


def get_user_groups(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    print("JWT CLAIMS:", json.dumps(claims))

    groups = claims.get("cognito:groups", "")

    if isinstance(groups, list):
        return groups

    if isinstance(groups, str):
        # Handles: "Admin"
        # Handles: "User,Admin"
        # Handles: '["User","Admin"]'
        groups = groups.replace("[", "").replace("]", "").replace('"', "")
        return [group.strip() for group in groups.split(",") if group.strip()]

    return []


def lambda_handler(event, context):
    try:
        groups = get_user_groups(event)
        print("USER GROUPS:", groups)
        if "Admin" not in groups:
            return {
                "statusCode": 403,
                "headers": HEADERS,
                "body": json.dumps({
                    "error": "Only admins can mark items as returned"
                })
            }
        if 'body' in event and event['body']:
            body = json.loads(event['body'])
        else:
            body = event

        item_id = body.get('itemId')
        new_status = body.get('status', 'Returned')

        if not item_id:
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({'error': 'itemId is required'})
            }

        table.update_item(
            Key={
                'itemId': item_id
            },
            UpdateExpression='SET #status = :status',
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': new_status
            }
        )

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({
                'message': 'Item status updated',
                'itemId': item_id,
                'status': new_status
            })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'error': str(e)})
        }
