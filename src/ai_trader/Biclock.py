import time
import requests
import winsound  # Windows

SYMBOL = "ETHUSDT"
TARGET_PRICE = 2190

def get_price():
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={SYMBOL}"
    return float(requests.get(url).json()["price"])

def alarm():
    while True:
        print("🚨 价格到了！！！")
        winsound.Beep(2000, 1000)  # 高频刺耳声音
        time.sleep(1)

while True:
    price = get_price()
    print("当前价格:", price)

    if price <= TARGET_PRICE:
        alarm()

    time.sleep(5)
