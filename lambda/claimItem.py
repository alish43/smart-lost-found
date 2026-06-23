import json
import boto3
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('LostFoundItems')

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS'
}


def get_user_claims(event):
    return (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )


def lambda_handler(event, context):
    try:
        claims = get_user_claims(event)

        claimed_by_user_id = claims.get("sub", "unknown")
        claimed_by_email = claims.get("email", "unknown")

        if 'body' in event and event['body']:
            body = json.loads(event['body'])
        else:
            body = event

        item_id = body.get('itemId')
        claimant_name = body.get('claimantName', '')
        claimant_contact = body.get('claimantContact', '')
        claim_reason = body.get('claimReason', '')

        if not item_id:
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({'error': 'itemId is required'})
            }

        if not claimant_name or not claimant_contact:
            return {
                'statusCode': 400,
                'headers': HEADERS,
                'body': json.dumps({
                    'error': 'claimantName and claimantContact are required'
                })
            }

        table.update_item(
            Key={'itemId': item_id},
            UpdateExpression="""
                SET #status = :status,
                    claimantName = :claimantName,
                    claimantContact = :claimantContact,
                    claimReason = :claimReason,
                    claimedAt = :claimedAt,
                    claimedByUserId = :claimedByUserId,
                    claimedByEmail = :claimedByEmail
            """,
            ExpressionAttributeNames={
                '#status': 'status'
            },
            ExpressionAttributeValues={
                ':status': 'Claimed',
                ':claimantName': claimant_name,
                ':claimantContact': claimant_contact,
                ':claimReason': claim_reason,
                ':claimedAt': datetime.utcnow().isoformat(),
                ':claimedByUserId': claimed_by_user_id,
                ':claimedByEmail': claimed_by_email
            }
        )

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps({
                'message': 'Claim request submitted',
                'itemId': item_id,
                'status': 'Claimed'
            })
        }

    except Exception as e:
        print("ERROR:", str(e))

        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({'error': str(e)})
        }
