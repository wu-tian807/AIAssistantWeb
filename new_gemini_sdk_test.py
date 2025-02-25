from google import genai
from PIL import Image
from initialization import gemini_pool
client = gemini_pool.get_client()

chat = client.chats.create(model="gemini-1.5-flash",history=["User:你好。","Assistant:你好，我是Gemini。","User:[图片][png]",Image.open("1.png")])

response = chat.send_message("你看到了什么")

print(response.text)