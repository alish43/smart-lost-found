import json
import boto3
import uuid
import base64
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
rekognition = boto3.client('rekognition')
sns = boto3.client('sns')

table = dynamodb.Table('LostFoundItems')

BUCKET_NAME = 'smart-lost-found-images'
SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:940932546281:LostFoundNotifications'

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
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
        created_by_user_id = claims.get("sub", "unknown")
        created_by_email = claims.get("email", "unknown")
        print("EVENT:", json.dumps(event)[:1000])

        if 'body' in event and event['body']:
            body = json.loads(event['body'])
        else:
            body = event

        item_id = str(uuid.uuid4())

        title = body.get('title', '')
        description = body.get('description', '')
        status = body.get('status', 'Lost')
        category = body.get('category', 'Other')
        location = body.get('location', '')
        contact_info = body.get('contactInfo', '')
        priority = body.get('priority', 'Medium')
        image_base64 = body.get('imageBase64', '')

        image_url = ''
        image_key = ''
        labels = []

        if image_base64:
            image_bytes = base64.b64decode(image_base64)
            image_key = f"items/{item_id}.jpg"

            s3.put_object(
                Bucket=BUCKET_NAME,
                Key=image_key,
                Body=image_bytes,
                ContentType='image/jpeg'
            )

            image_url = f"s3://{BUCKET_NAME}/{image_key}"

            rekognition_response = rekognition.detect_labels(
                Image={
                    'S3Object': {
                        'Bucket': BUCKET_NAME,
                        'Name': image_key
                    }
                },
                MaxLabels=5,
                MinConfidence=70
            )

            labels = [
                label['Name']
                for label in rekognition_response['Labels']
            ]

        item = {
            'itemId': item_id,
            'title': title,
            'description': description,
            'imageUrl': image_url,
            'imageKey': image_key,
            'labels': labels,
            'status': status,
            'category': category,
            'location': location,
            'contactInfo': contact_info,
            'priority': priority,
            'claimantName': '',
            'claimantContact': '',
            'claimedAt': '',
            'createdByUserId': created_by_user_id,
            'createdByEmail': created_by_email,
            'createdAt': datetime.utcnow().isoformat()
        }

        table.put_item(Item=item)

        message = f"""
New item added to Smart Lost & Found

Title: {title}
Description: {description}
AI Labels: {", ".join(labels) if labels else "No labels"}
Image Key: {image_key}
"""

        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject='New Lost & Found Item',
            Message=message
        )

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps(item)
        }

    except Exception as e:
        print("ERROR:", str(e))

        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({
                'error': str(e)
            })
        }
