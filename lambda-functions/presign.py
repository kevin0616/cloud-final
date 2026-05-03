import boto3
import json
import uuid
import os
from botocore.exceptions import ClientError

s3 = boto3.client('s3')

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'amzn-storage-bucket-final')
PRESIGNED_URL_EXPIRY = 300

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    }

    # Handle CORS preflight
    if event.get('httpMethod') == 'OPTIONS':
        return { 'statusCode': 200, 'headers': headers, 'body': '' }

    try:
        body = json.loads(event.get('body', '{}'))
        file_name = body.get('fileName', '')
        safe_name = file_name.replace(' ', '_')
        content_type = body.get('contentType', 'video/mp4')

        if not file_name:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({ 'error': 'fileName is required' })
            }

        unique_key = f"uploads/{uuid.uuid4()}-{safe_name}"

        presigned_url = s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': BUCKET_NAME,
                'Key': unique_key,
                'ContentType': content_type
            },
            ExpiresIn=PRESIGNED_URL_EXPIRY
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'uploadUrl': presigned_url,
                's3Key': unique_key
            })
        }

    except ClientError as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({ 'error': str(e) })
        }
