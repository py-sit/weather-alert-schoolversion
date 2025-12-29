using System;
using System.Diagnostics;
using System.IO;

class Program
{
    static int Main(string[] args)
    {
        try
        {
            var exeDir = AppContext.BaseDirectory;
            var batPath = Path.Combine(exeDir, "start_skyalert.bat");

            if (!File.Exists(batPath))
            {
                Console.Error.WriteLine("未找到 start_skyalert.bat，请将 exe 放在项目根目录。");
                Console.WriteLine("按任意键退出...");
                Console.ReadKey(true);
                return 1;
            }

            var psi = new ProcessStartInfo("cmd.exe")
            {
                Arguments = string.Format("/c \"\"{0}\"\"", batPath),
                WorkingDirectory = exeDir,
                UseShellExecute = false,
                CreateNoWindow = false
            };

            var process = Process.Start(psi);
            process.WaitForExit();
            return process.ExitCode;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("启动失败: {0}", ex.Message);
            Console.WriteLine("按任意键退出...");
            Console.ReadKey(true);
            return 1;
        }
    }
}
