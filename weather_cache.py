import json
import time
import sqlite3
import os

class WeatherCache:
    """天气数据缓存类，用于缓存天气API的响应数据"""
    
    def __init__(self, cache_db_path='instance/weather_cache.db', cache_duration=7200):
        """初始化缓存
        
        Args:
            cache_db_path: 缓存数据库路径
            cache_duration: 缓存有效期（秒），默认2小时
        """
        self.cache_db_path = cache_db_path
        self.cache_duration = cache_duration
        self._init_db()
    
    def _init_db(self):
        """初始化缓存数据库"""
        # 确保instance目录存在
        os.makedirs(os.path.dirname(self.cache_db_path), exist_ok=True)
        
        conn = sqlite3.connect(self.cache_db_path)
        cursor = conn.cursor()
        
        # 创建缓存表
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS weather_cache (
            cache_key TEXT PRIMARY KEY,
            data TEXT,
            timestamp INTEGER
        )
        ''')
        
        conn.commit()
        conn.close()
    
    def get(self, cache_key):
        """获取缓存数据
        
        Args:
            cache_key: 缓存键名
            
        Returns:
            缓存的数据（如果存在且未过期），否则返回None
        """
        conn = sqlite3.connect(self.cache_db_path)
        cursor = conn.cursor()
        
        cursor.execute(
            'SELECT data, timestamp FROM weather_cache WHERE cache_key = ?', 
            (cache_key,)
        )
        result = cursor.fetchone()
        conn.close()
        
        if not result:
            return None
        
        data, timestamp = result
        current_time = int(time.time())
        
        # 检查缓存是否过期
        if current_time - timestamp > self.cache_duration:
            return None
        
        return json.loads(data)
    
    def set(self, cache_key, data):
        """设置缓存数据
        
        Args:
            cache_key: 缓存键名
            data: 要缓存的数据
        """
        conn = sqlite3.connect(self.cache_db_path)
        cursor = conn.cursor()
        
        timestamp = int(time.time())
        data_json = json.dumps(data)
        
        cursor.execute(
            'INSERT OR REPLACE INTO weather_cache (cache_key, data, timestamp) VALUES (?, ?, ?)',
            (cache_key, data_json, timestamp)
        )
        
        conn.commit()
        conn.close()
    
    def clear(self, cache_key=None):
        """清除缓存数据
        
        Args:
            cache_key: 要清除的缓存键名，如果为None则清除所有缓存
        """
        conn = sqlite3.connect(self.cache_db_path)
        cursor = conn.cursor()
        
        if cache_key:
            cursor.execute('DELETE FROM weather_cache WHERE cache_key = ?', (cache_key,))
        else:
            cursor.execute('DELETE FROM weather_cache')
        
        conn.commit()
        conn.close()
    
    def clear_expired(self):
        """清除所有过期的缓存"""
        conn = sqlite3.connect(self.cache_db_path)
        cursor = conn.cursor()
        
        current_time = int(time.time())
        expiration_time = current_time - self.cache_duration
        
        cursor.execute('DELETE FROM weather_cache WHERE timestamp < ?', (expiration_time,))
        
        conn.commit()
        conn.close()