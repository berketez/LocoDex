import asyncio
import json
import subprocess
import time
import requests
import websockets
import sys
from concurrent.futures import ThreadPoolExecutor
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.spinner import Spinner

async def async_input(prompt_text):
    """Async input wrapper"""
    loop = asyncio.get_event_loop()
    executor = ThreadPoolExecutor(max_workers=1)
    
    def sync_input():
        console = Console()
        return Prompt.ask(prompt_text)
    
    try:
        result = await loop.run_in_executor(executor, sync_input)
        return result
    except (KeyboardInterrupt, EOFError):
        return None

def check_docker_services():
    """Docker servislerini kontrol et ve gerekirse başlat"""
    console = Console()
    
    # Docker servislerinin durumunu kontrol et
    try:
        result = subprocess.run(['docker-compose', 'ps', '--services', '--filter', 'status=running'], 
                              capture_output=True, text=True, check=True)
        running_services = result.stdout.strip().split('\n') if result.stdout.strip() else []
        
        if 'deep-research-service' not in running_services:
            console.print("🔄 Docker servisleri başlatılıyor...")
            
            # Docker servislerini başlat
            with console.status("[bold blue]Docker Compose servisleri başlatılıyor...[/bold blue]") as status:
                result = subprocess.run(['docker-compose', 'up', '-d'], 
                                      capture_output=True, text=True)
                
                if result.returncode != 0:
                    console.print(f"[bold red]Docker servisleri başlatılamadı:[/bold red] {result.stderr}")
                    return False
            
            console.print("✅ Docker servisleri başlatıldı!")
            
            # Servislerin hazır olmasını bekle
            with console.status("[bold blue]Servisler hazırlanıyor...[/bold blue]"):
                time.sleep(10)  # Servislerin başlaması için bekle
                
        else:
            console.print("✅ Docker servisleri zaten çalışıyor!")
            
        return True
        
    except subprocess.CalledProcessError as e:
        console.print(f"[bold red]Docker komutu başarısız:[/bold red] {e}")
        return False
    except FileNotFoundError:
        console.print("[bold red]Docker Compose bulunamadı! Lütfen Docker'ı yükleyin.[/bold red]")
        return False

def get_available_models():
    """LM Studio'dan mevcut modelleri al"""
    try:
        response = requests.get("http://localhost:1234/v1/models", timeout=5)
        if response.status_code == 200:
            models = response.json()
            return [model['id'] for model in models.get('data', [])]
    except:
        pass
    return []

def select_model():
    """Kullanıcının model seçmesini sağla"""
    console = Console()
    
    # Mevcut modelleri al
    models = get_available_models()
    
    if not models:
        console.print("⚠ [yellow]LM Studio'da aktif model bulunamadı. Varsayılan model kullanılacak.[/yellow]")
        return None
    
    console.print("\n🤖 [bold cyan]Mevcut AI Modelleri:[/bold cyan]")
    for i, model in enumerate(models, 1):
        console.print(f"  {i}. 🎬 {model}")
    
    try:
        choice_str = Prompt.ask(
            f"Kullanmak istediğiniz modelin numarasını seçin (enter = varsayılan)",
            default="1"
        )
        
        try:
            choice = int(choice_str)
            if 1 <= choice <= len(models):
                selected_model = models[choice - 1]
                console.print(f"✓ [green]{selected_model} modeli seçildi![/green]")
                return selected_model
            else:
                console.print("⚠ Geçersiz seçim, varsayılan model kullanılacak.")
                return models[0] if models else None
        except ValueError:
            console.print("⚠ Geçersiz giriş, varsayılan model kullanılacak.")
            return models[0] if models else None
            
    except (KeyboardInterrupt, EOFError):
        console.print("\n⚠ Model seçimi iptal edildi, varsayılan model kullanılacak.")
        return models[0] if models else None

async def main():
    console = Console()
    console.print("🤖 [bold cyan]LocoDex Deep Research CLI Başlatılıyor...[/bold cyan]\n")
    
    # Docker servislerini kontrol et ve başlat
    if not check_docker_services():
        console.print("\n💡 Lütfen Docker'ın çalıştığından emin olun ve tekrar deneyin.")
        return

    # Model seç
    selected_model = select_model()
    
    # Model seçimi sırasında model hazır durumunu kontrol et
    if selected_model:
        with console.status(f"[bold blue]{selected_model} modeli kontrol ediliyor...[/bold blue]"):
            time.sleep(2)
        console.print(f"✔ ✓ {selected_model} modeli hazır ve kullanıma uygun!")

    console.print(Panel("[bold cyan]🚀 LocoDex Deep Research CLI[/bold cyan]", 
                        title="Hoş Geldiniz!", 
                        subtitle="Çıkmak için 'quit' veya 'exit' yazın."))

    uri = "ws://localhost:8001/research_ws"

    # Servis bağlantısını dene
    max_retries = 3
    for attempt in range(max_retries):
        try:
            async with websockets.connect(uri) as websocket:
                console.print("✔ ✅ Derin araştırma servisine bağlandı!")
                console.print("💡 Araştırma yapmak için bir konu girin, çıkmak için 'quit' yazın.")

                while True:
                    try:
                        topic = await asyncio.wait_for(
                            async_input("\n[bold]🔍 Araştırmak istediğiniz konuyu girin[/bold]"),
                            timeout=300  # 5 dakika timeout
                        )
                        
                        if topic is None or topic.lower() in ["quit", "exit", "çık", "çıkış"]:
                            console.print("👋 Çıkış yapılıyor...")
                            break

                        await websocket.send(json.dumps({"topic": topic}))

                        spinner = Spinner("dots", text="Araştırma yapılıyor...")
                        with console.status(spinner) as status:
                            while True:
                                try:
                                    message_str = await websocket.recv()
                                    message = json.loads(message_str)

                                    if message["type"] == "progress":
                                        status.update(f"[bold blue]📊 {message['message']}[/bold blue]")
                                    elif message["type"] == "result":
                                        console.print(Panel(Markdown(message["data"]), 
                                                            title="[bold green]🎯 Araştırma Sonucu[/bold green]", 
                                                            border_style="green"))
                                        break # Exit the listening loop to ask for new topic
                                    elif message["type"] == "error":
                                        console.print(f"[bold red]❌ Hata:[/bold red] {message['data']}")
                                        break

                                except websockets.exceptions.ConnectionClosed:
                                    console.print("[bold red]✖ Derin araştırma servisiyle bağlantı kesildi.[/bold red]")
                                    return
                                except json.JSONDecodeError:
                                    console.print("[bold red]✖ Sunucudan geçersiz mesaj alındı.[/bold red]")
                                    
                    except asyncio.TimeoutError:
                        console.print("⏰ Zaman aşımı - 5 dakika boyunca input beklendi.")
                        continue
                    except (KeyboardInterrupt, EOFError):
                        console.print("\n👋 Çıkış yapılıyor...")
                        return
                        
                return

        except (websockets.exceptions.ConnectionClosedError, ConnectionRefusedError):
            if attempt < max_retries - 1:
                console.print(f"⚠ Servis bulunamadı. Yeniden deneniyor... ({attempt + 1}/{max_retries})")
                time.sleep(5)
            else:
                console.print("✖ Derin araştırma servisiyle bağlantı kurulamadı.")
                console.print("⚠ Servis bulunamadı. Otomatik olarak başlatılıyor...")
                
                # Servisleri yeniden başlatmayı dene
                if check_docker_services():
                    console.print("🔄 Servisleri yeniden başlatıldı. Lütfen tekrar deneyin.")
                else:
                    console.print("✖ Servisler başlatılamadı veya bağlantı yine başarısız oldu.")
                    console.print("\n💡 Lütfen Docker'ın çalıştığından emin olun ve tekrar deneyin.")
                    console.print("   Hata detayı: Command failed: docker-compose up -d")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n👋 LocoDex Deep Research CLI kapatılıyor...")
    except Exception as e:
        print(f"\n❌ Beklenmeyen hata: {e}")
        print("Lütfen tekrar deneyin veya destek alın.")