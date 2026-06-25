import json
import boto3

dynamodb = boto3.resource("dynamodb")
s3 = boto3.client("s3")

table = dynamodb.Table("LostFoundItems")
BUCKET_NAME = "smart-lost-found-images"

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
}


def get_user_groups(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )

    groups = claims.get("cognito:groups", "")

    if isinstance(groups, list):
        return groups

    if isinstance(groups, str):
        groups = groups.replace("[", "").replace("]", "").replace('"', "")
        return [group.strip() for group in groups.split(",") if group.strip()]

    return []


def lambda_handler(event, context):
    try:
        groups = get_user_groups(event)

        if "Admin" not in groups:
            return {
                "statusCode": 403,
                "headers": HEADERS,
                "body": json.dumps({
                    "error": "Only admins can delete items"
                })
            }

        path_params = event.get("pathParameters") or {}
        item_id = path_params.get("itemId")

        if not item_id:
            if event.get("body"):
                body = json.loads(event["body"])
                item_id = body.get("itemId")

        if not item_id:
            return {
                "statusCode": 400,
                "headers": HEADERS,
                "body": json.dumps({
                    "error": "itemId is required"
                })
            }

        existing_item = table.get_item(
            Key={"itemId": item_id}
        ).get("Item")

        if not existing_item:
            return {
                "statusCode": 404,
                "headers": HEADERS,
                "body": json.dumps({
                    "error": "Item not found"
                })
            }

        image_key = existing_item.get("imageKey", "")

        if image_key:
            try:
                s3.delete_object(
                    Bucket=BUCKET_NAME,
                    Key=image_key
                )
            except Exception as s3_error:
                print("S3 delete error:", str(s3_error))

        table.delete_item(
            Key={"itemId": item_id}
        )

        return {
            "statusCode": 200,
            "headers": HEADERS,
            "body": json.dumps({
                "message": "Item deleted successfully",
                "itemId": item_id
            })
        }

    except Exception as e:
        print("ERROR:", str(e))

        return {
            "statusCode": 500,
            "headers": HEADERS,
            "body": json.dumps({
                "error": str(e)
            })
        }
