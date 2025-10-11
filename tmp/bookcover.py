import requests
from bs4 import BeautifulSoup
import time
import os
from urllib.parse import quote

def search_douban_book(keyword, save_dir='douban_covers'):
    """
    在豆瓣搜索图书并下载封面
    """
    # 创建保存目录
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    
    # 构建搜索URL
    encoded_keyword = quote(keyword)
    search_url = f"https://www.douban.com/search?cat=1001&q={encoded_keyword}"
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': 'https://www.douban.com/'
    }
    
    try:
        print(f"正在搜索: {keyword}")
        response = requests.get(search_url, headers=headers, timeout=15)
        
        if response.status_code == 200:
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # 豆瓣搜索结果的多种可能结构
            # 尝试方式1: 找 class 包含 'result' 的div
            results = soup.find_all('div', class_='result')
            
            if not results:
                # 尝试方式2: 找所有图片
                results = soup.find_all('img', src=True)
            
            downloaded = False
            for idx, result in enumerate(results[:5]):  # 只处理前5个结果
                try:
                    # 查找图片
                    img_tag = None
                    if result.name == 'img':
                        img_tag = result
                    else:
                        img_tag = result.find('img')
                    
                    if img_tag and img_tag.get('src'):
                        img_url = img_tag['src']
                        
                        # 过滤掉非图书封面的图片
                        if 'doubanio.com' in img_url and '/view/' in img_url:
                            # 尝试获取大图URL
                            img_url = img_url.replace('/s/', '/l/')  # s=小图, l=大图
                            
                            print(f"  找到图片: {img_url}")
                            
                            # 下载图片
                            img_response = requests.get(img_url, headers=headers, timeout=10)
                            if img_response.status_code == 200:
                                filename = f"{keyword}_{idx+1}.jpg"
                                filepath = os.path.join(save_dir, filename)
                                
                                with open(filepath, 'wb') as f:
                                    f.write(img_response.content)
                                
                                print(f"  ✓ 已保存: {filepath}")
                                downloaded = True
                                
                                if idx == 0:  # 只下载第一个结果
                                    break
                
                except Exception as e:
                    continue
            
            if not downloaded:
                print(f"  ✗ 未找到有效封面")
                # 保存HTML用于调试
                with open(f'debug_{keyword}.html', 'w', encoding='utf-8') as f:
                    f.write(response.text)
                print(f"  已保存HTML到 debug_{keyword}.html 供分析")
            
            return downloaded
        else:
            print(f"  ✗ HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"  ✗ 错误: {str(e)}")
        return False


def batch_download_books(book_list, save_dir='douban_covers'):
    """
    批量下载图书封面
    """
    success_count = 0
    
    for book in book_list:
        if search_douban_book(book, save_dir):
            success_count += 1
        time.sleep(3)  # 重要：避免请求过快被封
    
    print(f"\n完成！成功下载 {success_count}/{len(book_list)} 本书的封面")


# 使用示例
if __name__ == "__main__":
    books = [
        "西游记",
        "三体",
        "活着",
        "百年孤独",
        "红楼梦"
    ]
    
    batch_download_books(books)