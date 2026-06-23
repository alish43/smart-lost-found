import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

table = dynamodb.Table('LostFoundItems')
BUCKET_NAME = 'smart-lost-found-images'

HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
}


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj)
    raise TypeError


def lambda_handler(event, context):
    try:
        response = table.scan()
        items = response.get('Items', [])

        for item in items:
            image_key = item.get('imageKey', '')

            if image_key:
                presigned_url = s3.generate_presigned_url(
                    'get_object',
                    Params={
                        'Bucket': BUCKET_NAME,
                        'Key': image_key
                    },
                    ExpiresIn=3600
                )

                item['displayImageUrl'] = presigned_url
            else:
                item['displayImageUrl'] = ''

        return {
            'statusCode': 200,
            'headers': HEADERS,
            'body': json.dumps(items, default=decimal_default)
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': HEADERS,
            'body': json.dumps({
                'error': str(e)
            })
        }
