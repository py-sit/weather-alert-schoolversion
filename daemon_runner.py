"""
简单守护脚本：如果 app.py 异常退出则自动重启。
适用场景：没有外部进程管理器时，为项目提供最基本的守护能力。
用法：python daemon_runner.py
"""

import os
import subprocess
import sys
import time

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

def main():
    cmd = [sys.executable, os.path.join(BASE_DIR, "app.py")]
    backoff = 3  # 异常退出后的等待时间（秒）

    while True:
        print(f"[daemon] 启动子进程: {' '.join(cmd)}")
        proc = subprocess.Popen(cmd, cwd=BASE_DIR)
        try:
            code = proc.wait()
        except KeyboardInterrupt:
            print("[daemon] 收到中断信号，停止守护")
            proc.terminate()
            break

        if code == 0:
            print("[daemon] 子进程正常退出，守护结束")
            break

        print(f"[daemon] 子进程异常退出，exit={code}，{backoff} 秒后重启...")
        time.sleep(backoff)


if __name__ == "__main__":
    main()
