import boto3
import json
import uuid
import os
from datetime import datetime

dynamodb = boto3.resource('dynamodb')
sqs      = boto3.client('sqs')

TABLE_NAME = os.environ.get('TABLE_NAME', 'videos')
QUEUE_URL  = os.environ.get('QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/725740881371/sqs-transcribe')

def lambda_handler(event, context):
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }

    if event.get('httpMethod') == 'OPTIONS':
        return { 'statusCode': 200, 'headers': headers, 'body': '' }

    try:
        body     = json.loads(event.get('body', '{}'))
        title    = body.get('title', 'Untitled')
        desc     = body.get('description')
        location = body.get('location')
        tags     = body.get('tags', [])
        s3_key   = body.get('s3Key')
        mime     = body.get('mimeType', 'video/mp4')
        size     = body.get('fileSize', 0)

        # get user id
        print('event:', event)
        user_id = event.get('requestContext', {}) \
                       .get('authorizer', {}) \
                       .get('claims', {}) \
                       .get('sub', 'anonymous')

        if not s3_key:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({ 'error': 's3Key is required' })
            }

        video_id = str(uuid.uuid4())

        # store metadata into DynamoDB
        table = dynamodb.Table(TABLE_NAME)
        table.put_item(Item={
            'videoId':   video_id,
            'userId':    user_id,
            'title':     title,
            'desc':      desc,
            'location':  location,
            'tags':      tags,
            's3Key':     s3_key,
            'mimeType':  mime,
            'fileSize':  size,
            'status':    'processing',  # pending → processing → done
            'createdAt': datetime.utcnow().isoformat()
        })

        # SQS
        sqs.send_message(
            QueueUrl=QUEUE_URL,
            MessageBody=json.dumps({
                'videoId': video_id,
                's3Key':   s3_key,
                'userId':  user_id
            })
        )

        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({ 'videoId': video_id, 'status': 'processing' })
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({ 'error': str(e) })
        }
