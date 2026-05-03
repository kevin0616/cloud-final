import json
import boto3
import os
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from botocore.config import Config

BUCKET_NAME = os.environ.get('BUCKET_NAME', 'amzn-storage-bucket-final')
SUB_BUCKET_NAME = os.environ.get('BUCKET_NAME', 'video-journal-frontend-cloudfinal')

# Initialize AWS SDK clients
dynamodb = boto3.resource('dynamodb')
region = os.environ.get('AWS_REGION', 'us-east-1')
service = 'es' # Service code for OpenSearch/Elasticsearch
credentials = boto3.Session().get_credentials()


# Environment Variables
TABLE_NAME = os.environ.get('RELATIONSHIP_TABLE', 'UserRelationships')
OPENSEARCH_HOST = os.environ.get('OPENSEARCH_HOST')
table = dynamodb.Table(TABLE_NAME)
videoTable = dynamodb.Table('videos')


def lambda_handler(event, context):
    """
    Routes requests based on the path to /feed or /search.
    """
    path = event.get('path', '')
    s3 = boto3.client(
        's3',
        region_name='us-east-1',
        endpoint_url='https://s3.us-east-1.amazonaws.com',
        config=Config(
            s3={'addressing_style': 'virtual'},
            signature_version='s3v4'
        )
    )
    try:
        # --- Handle Home Feed Logic ---
        if "/feed" in path:
            '''
            # Step 1: Fetch IDs of users the current user follows from DynamoDB
            
            following_ids = get_following_from_dynamo(current_user_id)
            
            if not following_ids:
                return build_response(200, {
                    "videos": [], 
                    "message": "Start following people to see their videos here!"
                })
            
            # Step 2: Query OpenSearch for latest videos from those users
            results = query_opensearch_for_feed(following_ids)
            return build_response(200, {"videos": results})
            '''
            try:
                current_user_id = event['requestContext']['authorizer']['claims']['sub']
                print(f"feed for {current_user_id}")

                response = videoTable.query(
                    IndexName='search-by-userid',
                    KeyConditionExpression=Key('userId').eq(current_user_id)
                )
                
                videos = response.get('Items', [])
                for video in videos:
                    # Video URL
                    if video.get('s3Key'):
                        video['url'] = s3.generate_presigned_url(
                            'get_object',
                            Params={ 'Bucket': BUCKET_NAME, 'Key': video['s3Key'] },
                            ExpiresIn=900
                        )
                    # Subtitle URL
                    if video.get('subtitleKey'):
                        video['subtitleUrl'] = s3.generate_presigned_url(
                            'get_object',
                            Params={ 'Bucket': SUB_BUCKET_NAME, 'Key': video['subtitleKey'] },
                            ExpiresIn=900
                        )

                
                return build_response(200, {"videos": videos})
                
            except KeyError:
                return build_response(401, {'message': 'Unauthorized: No user info found'})
        
            except Exception as e:
                print(e)
                return build_response(500, {'message': str(e)})
            
        # --- Handle Global Search Logic ---
        elif "/search" in path:
            query_params = event.get('queryStringParameters', {})
            query_text = query_params.get('q', '')
            search_type = query_params.get('type', 'all') # Options: all, video, user
            
            if not query_text:
                return build_response(400, {"message": "Search query 'q' is required"})
            
            # Perform multi-index search in OpenSearch
            results = query_opensearch_for_keyword(query_text, search_type)
            return build_response(200, {"results": results})

        return build_response(404, {"message": "Resource not found"})

    except Exception as e:
        print(f"Internal Error: {str(e)}")
        return build_response(500, {"error": "Internal Server Error"})

# --- Helper Functions ---

def get_following_from_dynamo(user_id):
    """
    Retrieves the list of targetUserIds that the given user is following.
    Assumes PK is 'userId' and SK is 'targetUserId'.
    """
    response = table.query(
        KeyConditionExpression=boto3.query.Key('userId').eq(f"USER#{user_id}")
    )
    # Clean prefixes from IDs (e.g., FOLLOW#123 -> 123)
    return [item['targetUserId'].replace('FOLLOW#', '') for item in response.get('Items', [])]

def query_opensearch_for_feed(following_ids):
    """
    Queries OpenSearch for videos posted by the following_ids list.
    Results are sorted by creation date descending.
    """
    url = f"{OPENSEARCH_HOST}/videos/_search"
    
    # OpenSearch DSL: Match any userId in the provided list
    query = {
        "size": 20,
        "query": {
            "terms": {
                "userId": following_ids
            }
        },
        "sort": [
            {"createdAt": {"order": "desc"}}
        ]
    }
    
    r = requests.get(url, auth=awsauth, json=query, headers={"Content-Type": "application/json"})
    hits = r.json().get('hits', {}).get('hits', [])
    return [hit['_source'] for hit in hits]

def query_opensearch_for_keyword(text, search_type):
    """
    Performs a full-text search across video metadata and user profiles.
    Uses multi-index search to combine results.
    """
    # Select indices based on requested type
    index = "videos,users"
    if search_type == 'video': index = "videos"
    if search_type == 'user': index = "users"
    
    url = f"{OPENSEARCH_HOST}/{index}/_search"
    
    # Multi-match query across multiple fields with fuzzy matching
    query = {
        "query": {
            "multi_match": {
                "query": text,
                "fields": ["title", "description", "username", "transcriptSnippet"],
                "fuzziness": "AUTO"
            }
        }
    }
    
    r = requests.get(url, auth=awsauth, json=query, headers={"Content-Type": "application/json"})
    hits = r.json().get('hits', {}).get('hits', [])
    
    # Format the results to tell the frontend whether it's a 'user' or a 'video'
    results = []
    for hit in hits:
        source = hit['_source']
        source['resultType'] = 'user' if hit['_index'] == 'users' else 'video'
        results.append(source)
    return results

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def build_response(status_code, body):
    """Utility to generate standard API Gateway Proxy Response."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' # Required for Cross-Origin (CORS) support
        },
        'body': json.dumps(body, cls=DecimalEncoder)    
    }