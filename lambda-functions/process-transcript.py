import boto3
import json
import os
from decimal import Decimal

s3         = boto3.client('s3')
comprehend = boto3.client('comprehend')
dynamodb   = boto3.resource('dynamodb')

BUCKET_NAME     = os.environ.get('BUCKET_NAME', 'amzn-storage-bucket-final')
TABLE_NAME      = os.environ.get('TABLE_NAME', 'videos')
SUBTITLE_PREFIX = 'subtitles/'

def float_to_decimal(obj):
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [float_to_decimal(i) for i in obj]
    return obj

def lambda_handler(event, context):
    detail   = event.get('detail', {})
    job_name = detail.get('TranscriptionJobName', '')
    status   = detail.get('TranscriptionJobStatus', '')

    print(f"Job: {job_name}, Status: {status}")

    if status != 'COMPLETED':
        print(f"Job not complete: {status}")
        update_dynamodb(job_name.replace('transcribe-', ''), 'failed', {})
        return

    video_id = job_name.replace('transcribe-', '')

    # ── 1: Read Transcribe JSON from S3 ──
    transcript_key = f"transcripts/{video_id}.json"
    obj = s3.get_object(Bucket=BUCKET_NAME, Key=transcript_key)
    transcript_data = json.loads(obj['Body'].read().decode('utf-8'))

    transcript_text = transcript_data['results']['transcripts'][0]['transcript']
    items           = transcript_data['results']['items']

    print(f"Transcript length: {len(transcript_text)} chars")

    # ── 2: Convert to .vtt subtitle file ──
    vtt_content  = convert_to_vtt(items)
    subtitle_key = f"{SUBTITLE_PREFIX}{video_id}.vtt"
    s3.put_object(
        Bucket='video-journal-frontend-cloudfinal',
        Key=subtitle_key,
        Body=vtt_content.encode('utf-8'),
        ContentType='text/vtt'
    )
    print(f"Subtitle saved: {subtitle_key}")

    # ── 3: Run Comprehend ──
    text_chunk = transcript_text[:4900]

    sentiment_res  = comprehend.detect_sentiment(
        Text=text_chunk,
        LanguageCode='en'
    )
    entities_res   = comprehend.detect_entities(
        Text=text_chunk,
        LanguageCode='en'
    )
    keyphrases_res = comprehend.detect_key_phrases(
        Text=text_chunk,
        LanguageCode='en'
    )

    comprehend_result = {
        'sentiment':      sentiment_res['Sentiment'],
        'sentimentScore': sentiment_res['SentimentScore'],
        'entities': [
            { 'text': e['Text'], 'type': e['Type'], 'score': round(e['Score'], 3) }
            for e in entities_res['Entities'] if e['Score'] > 0.8
        ],
        'keyPhrases': [
            { 'text': k['Text'], 'score': round(k['Score'], 3) }
            for k in keyphrases_res['KeyPhrases'] if k['Score'] > 0.8
        ]
    }
    
    comprehend_result = float_to_decimal(comprehend_result)

    print(f"Sentiment: {comprehend_result['sentiment']}")
    print(f"Entities: {len(comprehend_result['entities'])} found")
    print(f"Key phrases: {len(comprehend_result['keyPhrases'])} found")

    # ── 4: Update DynamoDB ──
    update_dynamodb(video_id, 'done', {
        'transcript':    transcript_text,
        'subtitleKey':   subtitle_key,
        'sentiment':     comprehend_result['sentiment'],
        'sentimentScore': comprehend_result['sentimentScore'],
        'entities':      comprehend_result['entities'],
        'keyPhrases':    comprehend_result['keyPhrases']
    })

    print(f"Done processing videoId: {video_id}")


def update_dynamodb(video_id, status, extra):
    table = dynamodb.Table(TABLE_NAME)

    update_expr = "SET #st = :status"
    expr_names  = { '#st': 'status' }
    expr_values = { ':status': status }

    for key, val in extra.items():
        update_expr += f", {key} = :{key}"
        expr_values[f":{key}"] = val

    table.update_item(
        Key={ 'videoId': video_id },
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values
    )


def convert_to_vtt(items):
    """Convert Transcribe items array to WebVTT format."""
    vtt_lines     = ['WEBVTT', '']
    segment_words = []
    segment_start = None
    segment_end   = None
    counter       = 1

    for item in items:
        if item['type'] == 'punctuation':
            if segment_words:
                segment_words[-1] += item['alternatives'][0]['content']
            continue

        word       = item['alternatives'][0]['content']
        start_time = float(item.get('start_time', 0))
        end_time   = float(item.get('end_time', 0))

        if segment_start is None:
            segment_start = start_time

        segment_words.append(word)
        segment_end = end_time

        # New segment every ~8 words or ~5 seconds
        if len(segment_words) >= 8 or (segment_end - segment_start) >= 5:
            vtt_lines.append(str(counter))
            vtt_lines.append(f"{fmt(segment_start)} --> {fmt(segment_end)}")
            vtt_lines.append(' '.join(segment_words))
            vtt_lines.append('')
            counter += 1
            segment_words = []
            segment_start = None
            segment_end   = None

    # Flush remaining words
    if segment_words and segment_start is not None:
        vtt_lines.append(str(counter))
        vtt_lines.append(f"{fmt(segment_start)} --> {fmt(segment_end)}")
        vtt_lines.append(' '.join(segment_words))
        vtt_lines.append('')

    return '\n'.join(vtt_lines)


def fmt(seconds):
    """Convert seconds to VTT timestamp: HH:MM:SS.mmm"""
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
