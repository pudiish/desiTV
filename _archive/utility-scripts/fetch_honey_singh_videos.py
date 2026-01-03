#!/usr/bin/env python3
"""
Fetch YouTube video links for Honey Singh OG era songs.
Uses YouTube Data API to search and verify links.

Usage:
    python fetch_honey_singh_videos.py

Requirements:
    pip install google-api-python-client

Environment Variables:
    YOUTUBE_API_KEY - Your YouTube Data API key
"""

import os
import sys
from pathlib import Path

try:
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
except ImportError:
    print("❌ Missing required package. Install with:")
    print("   pip install google-api-python-client")
    sys.exit(1)

# Load environment variables
try:
    from dotenv import load_dotenv
    project_root = Path(__file__).parent.parent
    load_dotenv(project_root / ".env")
except ImportError:
    pass

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

# OG Honey Singh songs to search (2011-2015 era)
SONGS_TO_FETCH = [
    # Solo / Main artist - OG Era
    "Brown Rang Yo Yo Honey Singh International Villager",
    "Blue Eyes Yo Yo Honey Singh Blockbuster",
    "Desi Kalakaar Yo Yo Honey Singh Sonakshi",
    "Love Dose Yo Yo Honey Singh Urvashi",
    
    # Punjabi collaborations
    "Angreji Beat Yo Yo Honey Singh Gippy Grewal",
    "High Heels Jaz Dhami Honey Singh",
    "Dope Shope Yo Yo Honey Singh Deep Money",
    "Lak 28 Kudi Da Diljit Dosanjh Honey Singh Lion of Punjab",
    "Gabru J Star Yo Yo Honey Singh",
    "Birthday Bash Yo Yo Honey Singh Alfaaz",
    "Morni Banke Honey Singh Punjabi",
    "Aashiq Banaya Aapne Honey Singh",
    "This Party Getting Hot Honey Singh",
    
    # Bollywood songs
    "Lungi Dance Chennai Express Shah Rukh Khan Honey Singh",
    "Party All Night Boss Akshay Kumar Honey Singh",
    "Sunny Sunny Yaariyan Neha Kakkar Honey Singh",
    "Chaar Botal Vodka Ragini MMS 2 Honey Singh",
    "ABCD Yaariyan Yo Yo Honey Singh",
    "Main Sharabi Cocktail Honey Singh",
    "Party on My Mind Race 2 Honey Singh",
    "Aata Majhi Satakli Singham Returns Honey Singh",
    "Manali Trance The Shaukeens Honey Singh",
    "Alcoholic The Shaukeens Yo Yo Honey Singh",
    "Subhah Hone Na De Desi Boyz Honey Singh",
    "Lonely Lonely Khiladi 786 Honey Singh",
    "Kudi Tu Butter Honey Singh Bajatey Raho",
    "Bhoothnath Returns Party Honey Singh",
    "Fugly Fugly Kya Hai Yo Yo Honey Singh",
    "Yaar Naa Miley Kick Honey Singh",
    "Aankhon Aankhon Bhaag Johnny Honey Singh",
    "Dheere Dheere Hrithik Sonam Honey Singh",
    
    # Early Punjabi underground/cult classics
    "Panga Diljit Dosanjh Honey Singh",
    "Glassi Honey Singh Punjabi",
    "Bring Me Back Yo Yo Honey Singh",
]


def search_youtube_video(youtube, query, max_results=1):
    """Search for a YouTube video and return the most relevant result."""
    try:
        search_response = youtube.search().list(
            q=query,
            part="id,snippet",
            maxResults=max_results,
            type="video",
            videoDuration="medium",  # Filter out shorts (short) and very long videos
            order="relevance"
        ).execute()
        
        for item in search_response.get("items", []):
            video_id = item["id"]["videoId"]
            title = item["snippet"]["title"]
            channel = item["snippet"]["channelTitle"]
            
            # Basic filtering - skip lyrics/audio only
            title_lower = title.lower()
            if "lyric" in title_lower or "audio only" in title_lower:
                continue
                
            return {
                "video_id": video_id,
                "title": title,
                "channel": channel,
                "url": f"https://www.youtube.com/watch?v={video_id}"
            }
        
        return None
    except HttpError as e:
        print(f"❌ API Error: {e}")
        return None


def get_video_details(youtube, video_id):
    """Get video details to verify it's a proper video (not short)."""
    try:
        response = youtube.videos().list(
            part="contentDetails,statistics",
            id=video_id
        ).execute()
        
        if response.get("items"):
            item = response["items"][0]
            duration = item["contentDetails"]["duration"]
            view_count = int(item["statistics"].get("viewCount", 0))
            return {
                "duration": duration,
                "views": view_count
            }
        return None
    except HttpError:
        return None


def main():
    if not YOUTUBE_API_KEY:
        print("❌ YOUTUBE_API_KEY not found!")
        print("   Set it in your .env file or as an environment variable")
        print("   Get one from: https://console.cloud.google.com/apis/credentials")
        sys.exit(1)
    
    print("=" * 60)
    print("🎵 Honey Singh OG Era Video Fetcher")
    print("=" * 60)
    
    # Build YouTube API client
    youtube = build("youtube", "v3", developerKey=YOUTUBE_API_KEY)
    
    output_file = Path(__file__).parent.parent / "honey.txt"
    found_videos = []
    seen_ids = set()  # Track unique video IDs
    
    print(f"\n🔍 Searching for {len(SONGS_TO_FETCH)} songs...\n")
    
    for i, query in enumerate(SONGS_TO_FETCH, 1):
        print(f"[{i}/{len(SONGS_TO_FETCH)}] Searching: {query[:50]}...")
        
        result = search_youtube_video(youtube, query)
        
        if result:
            # Skip duplicates
            if result["video_id"] in seen_ids:
                print(f"   ⏭️  Duplicate skipped")
                continue
                
            # Verify it has decent views (filter out random uploads)
            details = get_video_details(youtube, result["video_id"])
            if details and details["views"] > 100000:  # At least 100K views
                found_videos.append(result)
                seen_ids.add(result["video_id"])
                print(f"   ✅ Found: {result['title'][:50]}... ({details['views']:,} views)")
            else:
                print(f"   ⚠️  Skipped (low views): {result['title'][:40]}...")
        else:
            print(f"   ❌ Not found")
    
    # Write to file
    print(f"\n💾 Writing {len(found_videos)} videos to {output_file}")
    
    with open(output_file, "w") as f:
        f.write("# Yo Yo Honey Singh - OG Era YouTube Video Links\n")
        f.write("# Auto-generated via YouTube API\n")
        f.write(f"# Total: {len(found_videos)} verified videos\n\n")
        
        for video in found_videos:
            f.write(f"{video['url']}\n")
    
    print("\n" + "=" * 60)
    print(f"✅ Done! {len(found_videos)} video links saved to honey.txt")
    print("=" * 60)


if __name__ == "__main__":
    main()
