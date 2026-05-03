import boto3
import json
import os

transcribe = boto3.client('transcribe')

BUCKET_NAME      = os.environ.get('BUCKET_NAME', 'amzn-storage-bucket-final')
OUTPUT_BUCKET    = os.environ.get('OUTPUT_BUCKET', 'amzn-storage-bucket-final')
OUTPUT_PREFIX    = 'transcripts/'

def lambda_handler(event, context):
    FORMAT_MAP = {
        'mov': 'mp4',
        'avi': 'mp4',
        'mkv': 'mp4',
        'wmv': 'mp4',
        'mp4': 'mp4',
        'mp3': 'mp3',
        'm4a': 'm4a',
        'wav': 'wav',
        'flac': 'flac',
        'ogg': 'ogg',
        'webm': 'webm',
        'amr': 'amr',
    }
    for record in event['Records']:
        body = json.loads(record['body'])

        video_id = body['videoId']
        s3_key   = body['s3Key']

        media_uri = f"s3://{BUCKET_NAME}/{s3_key}"
        print(media_uri)
        job_name  = f"transcribe-{video_id}"

        print(f"Starting transcription job: {job_name} for {media_uri}")

        ext = s3_key.split('.')[-1].lower()
        transcribe.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={ 'MediaFileUri': media_uri },
            MediaFormat = FORMAT_MAP.get(ext, 'mp4'),
            LanguageCode='en-US',
            OutputBucketName=OUTPUT_BUCKET,
            OutputKey=f"{OUTPUT_PREFIX}{video_id}.json",
            Settings={
                'ShowSpeakerLabels': False,
                'ShowAlternatives': False
            }
        )

        print(f"Transcription job started: {job_name}")
