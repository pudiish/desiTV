from googleapiclient.discovery import build
import json
import os
from dotenv import load_dotenv

load_dotenv()  # loads variables from a .env file into the environment

API_KEY = os.getenv("YOUTUBE_API_KEY")
if not API_KEY:
    raise RuntimeError("YOUTUBE_API_KEY not found in environment or .env file")

youtube = build("youtube", "v3", developerKey=API_KEY)

songs = [
    "Main Prem Ki Diwani Hoon",
    "Bani Bani",
    "Kasam Ki Kasam",
    "O Ajnabi",
    "Chali Aayee",
    "Sanjana I Love You",
    "Ladka Yeh Kehta Hai Ladki Se",
    "Aur Mohabbat Hai",
    "Papa Ki Pari",
    "Rehnaa Hai Terre Dil Mein Title Track",
    "Dilko Tumse Pyaar Hua",
    "Bolo Bolo Kya Baat Hui Hai",
    "Oh Mama Mama",
    "Kaise Main Kahoon",
    "Such Keh Raha Hai",
    "Zaraa Zaraa",
    "Kabhi Khushi Kabhie Gham Title Track",
    "Bole Chudiyan",
    "Suraj Hua Maddham",
    "Yeh Ladka Hai Allah",
    "You Are My Soniya",
    "Say Shava Shava",
    "K3G Title Track",
    "Deewana Hai Dekho",
    "Dhoom Title Track",
    "Dhoom 2 Dilbara",
    "Salaame",
    "Dil Laga Na",
    "My Name Is Ali",
    "Crazy Kiya Re",
    "Dhoom Again",
    "Touch Me Song",
    "Lakshya Title Track",
    "Agar Main Kahoon",
    "Main Aisa Kyun Hoon",
    "Kitni Baatein",
    "Lakshya Title Track",
    "Kandhon Se Milte Hain Kandhe",
    "Krrish Pyaar Ki Ek Kahani",
    "Koi Tumsa Nahin",
    "Dil Na Diya",
    "Chori Chori Chupke Chupke",
    "Main Hoon Woh Aasman",
    "Jhankaar Beats Tu Aashiqui Hai",
    "Suno Na",
    "Lagaan Radha Kaise Na Jale",
    "Ghanan Ghanan",
    "Mitwa Lagaan",
    "Chale Chalo",
    "O Paalanhaare",
    "O Rey Chhori",
    "Tum Bin Koi Fariyaad",
    "Tum Bin Jiya Jaye Kaise",
    "Chhoti Chhoti Raatein",
    "Barso Re Guru",
    "Saaki Saaki Musafir",
    "Ainvayi Ainvayi",
    "Twist Love Aaj Kal",
    "Aahun Aahun Love Aaj Kal",
    "O Humdum Suniyo Re",
    "Soni De Nakhre Partner",
    "Bhool Bhulaiyaa Hare Ram",
    "Chandni Chowk to China Title Track",
    "Kya Mujhe Pyar Hai Woh Lamhe"
]

def search_youtube_id(query):
    req = youtube.search().list(
        q=query + " song",
        part="snippet",
        maxResults=1,
        type="video"
    )
    res = req.execute()
    if res["items"]:
        return res["items"][0]["id"]["videoId"]
    return ""

output_items = []

for index, song in enumerate(songs):
    youtube_id = search_youtube_id(song)
    output_items.append({
        "title": song,
        "youtubeId": youtube_id,
        "duration": 0,   # You can update later
        "tags": [],
        "_id": {"$oid": f"custom_music_{index}"}
    })

final_json = {
    "_id": {"$oid": "693091b4054578621f1918fd"},
    "name": "Music",
    "playlistStartEpoch": {"$date": "2020-01-01T00:00:00.000Z"},
    "items": output_items,
    "__v": 0
}

with open("music_playlist.json", "w") as f:
    json.dump(final_json, f, indent=4)

print("Generated: music_playlist.json")
