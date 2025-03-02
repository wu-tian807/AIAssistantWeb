from initialization import oaipro_client
response = oaipro_client.chat.completions.create(
    model="o3-mini",
    reasoning_effort='low',
    messages=[{"role": "user", "content": "What is the capital of France?"}],
    stream=True
)

print("开始输出")
print("进入for循环前")
for chunk in response:
    if chunk.choices[0].delta.content is not None:
        print("输出正常内容:",end="")
        print(chunk.choices[0].delta.content)
    else:
        print("输出思考内容:",end="")
        #print(chunk.choices[0].delta.reasoning_content)

print("结束for循环")
print("结束输出")