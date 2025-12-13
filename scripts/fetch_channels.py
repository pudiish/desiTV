#!/usr/bin/env python3
"""
Fetch channels data from MongoDB and store to channels.json

Usage:
    python fetch_channels.py
    
Requirements:
    pip install pymongo python-dotenv

Environment Variables:
    MONGO_URI - MongoDB connection string (reads from .env file)
"""

import os
import json
import sys
from datetime import datetime
from pathlib import Path

try:
    from pymongo import MongoClient
    from dotenv import load_dotenv
except ImportError:
    print("❌ Missing required packages. Install them with:")
    print("   pip install pymongo python-dotenv")
    sys.exit(1)


def get_mongo_uri():
    """Load MongoDB URI from environment or .env file"""
    # Try loading from .env file in project root
    project_root = Path(__file__).parent.parent
    env_path = project_root / ".env"
    
    if env_path.exists():
        load_dotenv(env_path)
        print(f"📄 Loaded environment from: {env_path}")
    
    mongo_uri = os.getenv("MONGO_URI")
    
    if not mongo_uri:
        print("❌ MONGO_URI environment variable not found!")
        print("   Please set it in your .env file or environment")
        sys.exit(1)
    
    return mongo_uri


def serialize_object_id(obj):
    """Convert MongoDB ObjectId to string for JSON serialization"""
    if hasattr(obj, '__iter__') and not isinstance(obj, (str, dict)):
        return [serialize_object_id(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: serialize_object_id(value) for key, value in obj.items()}
    elif hasattr(obj, 'isoformat'):  # datetime objects
        return obj.isoformat()
    elif hasattr(obj, '__str__') and type(obj).__name__ == 'ObjectId':
        return str(obj)
    else:
        return obj


def fetch_channels_from_mongodb(mongo_uri):
    """Connect to MongoDB and fetch all channels"""
    print("🔌 Connecting to MongoDB...")
    
    try:
        client = MongoClient(mongo_uri)
        # Test the connection
        client.admin.command('ping')
        print("✅ Connected to MongoDB successfully!")
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")
        sys.exit(1)
    
    # Get the database (extract from URI or use default)
    db = client.get_default_database()
    if db is None:
        # Fallback to 'retro-tv' database name
        db = client['retro-tv']
    
    print(f"📦 Using database: {db.name}")
    
    # Fetch all channels from the 'channels' collection
    channels_collection = db['channels']
    channels = list(channels_collection.find({}))
    
    print(f"📺 Found {len(channels)} channels")
    
    client.close()
    return channels


def transform_channels(channels):
    """Transform MongoDB documents to the expected JSON format"""
    transformed = []
    
    for channel in channels:
        transformed_channel = {
            "_id": str(channel.get("_id", "")),
            "name": channel.get("name", ""),
            "playlistStartEpoch": channel.get("playlistStartEpoch", "").isoformat() 
                if hasattr(channel.get("playlistStartEpoch", ""), 'isoformat') 
                else channel.get("playlistStartEpoch", ""),
            "items": []
        }
        
        # Transform items (videos)
        for item in channel.get("items", []):
            transformed_item = {
                "_id": str(item.get("_id", "")),
                "title": item.get("title", ""),
                "youtubeId": item.get("youtubeId", ""),
                "duration": item.get("duration", 30),
                "year": item.get("year"),
                "tags": item.get("tags", []),
                "category": item.get("category")
            }
            transformed_channel["items"].append(transformed_item)
        
        transformed.append(transformed_channel)
        print(f"  📺 {channel.get('name', 'Unknown')}: {len(channel.get('items', []))} videos")
    
    return transformed


def save_to_json(channels, output_path):
    """Save channels data to JSON file"""
    # Create the output structure matching the existing format
    output_data = {
        "version": int(datetime.now().timestamp() * 1000),
        "generatedAt": datetime.now().isoformat() + "Z",
        "channels": channels
    }
    
    # Ensure directory exists
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)
    
    print(f"💾 Saved to: {output_path}")
    return output_path


def main():
    """Main entry point"""
    print("=" * 50)
    print("🚀 DesiTV Channel Fetcher")
    print("=" * 50)
    
    # Determine output paths
    project_root = Path(__file__).parent.parent
    output_paths = [
        project_root / "channels.json",
        project_root / "client" / "public" / "data" / "channels.json"
    ]
    
    # Get MongoDB URI
    mongo_uri = get_mongo_uri()
    
    # Fetch channels from MongoDB
    channels = fetch_channels_from_mongodb(mongo_uri)
    
    if not channels:
        print("⚠️  No channels found in database!")
        sys.exit(0)
    
    # Transform channels to JSON format
    print("\n🔄 Transforming channel data...")
    transformed_channels = transform_channels(channels)
    
    # Save to JSON files
    print("\n💾 Saving to JSON files...")
    for output_path in output_paths:
        save_to_json(transformed_channels, output_path)
    
    print("\n" + "=" * 50)
    print("✅ Successfully fetched and saved channel data!")
    print(f"   Total channels: {len(transformed_channels)}")
    total_videos = sum(len(ch.get('items', [])) for ch in transformed_channels)
    print(f"   Total videos: {total_videos}")
    print("=" * 50)


if __name__ == "__main__":
    main()
