import json
import boto3

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

table = dynamodb.Table('LostFoundItems')

SNS_TOPIC_ARN = 'arn:aws:sns:us-east-1:940932546281:LostFoundNotifications'


def lambda_handler(event, context):
    try:
        response = table.scan()
        items = response.get('Items', [])

        total_items = len(items)

        latest_items = items[-5:] if len(items) > 5 else items

        item_lines = []

        for item in latest_items:
            title = item.get('title', 'No title')
            description = item.get('description', 'No description')
            labels = item.get('labels', [])

            item_lines.append(
                f"- {title}: {description} | Labels: {', '.join(labels) if labels else 'No labels'}"
            )

        message = f"""
Smart Lost & Found Daily Summary

Total reported items: {total_items}

Latest items:
{chr(10).join(item_lines) if item_lines else 'No items found.'}
"""

        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject='Smart Lost & Found Daily Summary',
            Message=message
        )

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Daily summary sent',
                'totalItems': total_items
            })
        }

    except Exception as e:
        print("ERROR:", str(e))

        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': str(e)
            })
        }
