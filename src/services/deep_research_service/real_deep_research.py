import asyncio
import aiohttp
import json
from datetime import datetime
import os
import logging

logger = logging.getLogger(__name__)

class RealDeepResearcher:
    """Gerçek web araması yapan deep research sistemi"""
    
    def __init__(self, model_name, model_source, websocket):
        self.model_name = model_name
        self.model_source = model_source
        self.websocket = websocket
        self.search_results = []
        
    async def call_local_model(self, prompt, system_prompt="", max_tokens=3000):
        """Lokal modeli asenkron olarak çağırır - Ollama ve LM Studio desteği"""
        try:
            logger.info(f"call_local_model called with model_source: '{self.model_source}', model_name: '{self.model_name}'")
            import socket
            
            # Host IP'yi bul - Docker container'dan host'a erişim için
            try:
                # Docker compose network'te host.docker.internal kullan
                host_ip = socket.gethostbyname('host.docker.internal')
            except:
                # Fallback IP'ler - macOS Docker Desktop için
                try:
                    host_ip = "192.168.65.1"  # Docker Desktop default gateway
                except:
                    try:
                        host_ip = "172.17.0.1"  # Docker bridge network
                    except:
                        host_ip = "localhost"

            async with aiohttp.ClientSession() as session:
                logger.info(f"Model source comparison: '{self.model_source}' == 'Ollama' ? {self.model_source == 'Ollama'}")
                if self.model_source == "Ollama":
                    try:
                        # Model yükleniyor bildirimi
                        await self.websocket.send_json({
                            "type": "progress", 
                            "step": 0, 
                            "message": f"🔄 {self.model_name} modeli yükleniyor (ilk kullanımda zaman alabilir)..."
                        })
                        
                        ollama_url = f"http://{host_ip}:11434/api/generate"
                        ollama_payload = {
                            "model": self.model_name,
                            "prompt": f"{system_prompt}\n\nUser: {prompt}\n\nAssistant:",
                            "stream": False,
                            "options": {
                                "temperature": 0.3,
                                "num_predict": max_tokens
                            }
                        }
                        
                        async with session.post(ollama_url, json=ollama_payload, timeout=300) as response:
                            logger.info(f"Ollama request to {ollama_url} with payload: {ollama_payload}")
                            logger.info(f"Ollama response status: {response.status}")
                            if response.status == 200:
                                data = await response.json()
                                return data.get('response', '').strip()
                            else:
                                error_text = await response.text()
                                logger.error(f"Ollama HTTP {response.status} error: {error_text}")
                                return f"Ollama hatası: {response.status} - {error_text}"
                    except Exception as ollama_error:
                        return f"Ollama hatası: {ollama_error}"
                
                elif self.model_source == "LM Studio":
                    try:
                        lm_studio_url = f"http://{host_ip}:1234/v1/chat/completions"
                        lm_payload = {
                            "model": self.model_name,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.3,
                            "max_tokens": max_tokens,
                            "stream": False
                        }
                        
                        async with session.post(lm_studio_url, json=lm_payload, timeout=120) as response:
                            if response.status == 200:
                                data = await response.json()
                                content = data['choices'][0]['message']['content']
                                return content.strip()
                            else:
                                return f"LM Studio hatası: {response.status}"
                    except Exception as lm_error:
                        # LM Studio çalışmıyorsa Ollama'ya fallback yap
                        logger.warning(f"LM Studio erişilemez, Ollama'ya geçiliyor: {lm_error}")
                        try:
                            ollama_url = f"http://{host_ip}:11434/api/generate"
                            ollama_payload = {
                                "model": self.model_name,
                                "prompt": f"{system_prompt}\n\nUser: {prompt}\n\nAssistant:",
                                "stream": False,
                                "options": {
                                    "temperature": 0.3,
                                    "num_predict": max_tokens
                                }
                            }
                            
                            async with session.post(ollama_url, json=ollama_payload, timeout=300) as response:
                                if response.status == 200:
                                    data = await response.json()
                                    return data.get('response', '').strip()
                                else:
                                    return f"Hem LM Studio hem Ollama erişilemez"
                        except:
                            return f"Model bağlantı hatası: LM Studio çalışmıyor, Ollama'ya da erişilemedi"
                
                else: # Kaynak bilinmiyorsa önce LM Studio dene, sonra Ollama
                    try:
                        lm_studio_url = f"http://{host_ip}:1234/v1/chat/completions"
                        lm_payload = {
                            "model": self.model_name,
                            "messages": [
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": prompt}
                            ],
                            "temperature": 0.3,
                            "max_tokens": max_tokens,
                            "stream": False
                        }
                        
                        async with session.post(lm_studio_url, json=lm_payload, timeout=120) as response:
                            if response.status == 200:
                                data = await response.json()
                                content = data['choices'][0]['message']['content']
                                return content.strip()
                    except:
                        pass
                    
                    try:
                        ollama_url = f"http://{host_ip}:11434/api/generate"
                        ollama_payload = {
                            "model": self.model_name,
                            "prompt": f"{system_prompt}\n\nUser: {prompt}\n\nAssistant:",
                            "stream": False,
                            "options": {
                                "temperature": 0.3,
                                "num_predict": max_tokens
                            }
                        }
                        
                        async with session.post(ollama_url, json=ollama_payload, timeout=300) as response:
                            if response.status == 200:
                                data = await response.json()
                                return data.get('response', '').strip()
                    except:
                        pass
                
                return "Model bağlantı hatası: Hem LM Studio hem Ollama erişilemez"

        except Exception as e:
            return f"Model bağlantı hatası: {str(e)}"

    async def search_web(self, query, max_results=5):
        """Web araması yapar - DuckDuckGo kullanarak"""
        try:
            await self.websocket.send_json({
                "type": "progress", 
                "step": 0.1, 
                "message": f"🌐 Web'de '{query}' araştırılıyor..."
            })
            
            # DuckDuckGo search async wrapper
            import asyncio
            import concurrent.futures
            
            def sync_search():
                from duckduckgo_search import DDGS
                ddgs = DDGS()
                return list(ddgs.text(query, max_results=max_results))
            
            # Run sync search in thread pool
            with concurrent.futures.ThreadPoolExecutor() as executor:
                search_results = await asyncio.get_event_loop().run_in_executor(
                    executor, sync_search
                )
            
            results = []
            for i, result in enumerate(search_results):
                if i >= max_results:
                    break
                    
                results.append({
                    'title': result.get('title', ''),
                    'body': result.get('body', ''),
                    'url': result.get('href', ''),
                    'source': 'DuckDuckGo'
                })
                
                await self.websocket.send_json({
                    "type": "progress", 
                    "step": 0.1 + (i * 0.05), 
                    "message": f"📄 Kaynak bulundu: {result.get('title', '')[:60]}..."
                })
            
            return results
            
        except Exception as e:
            logger.error(f"Web search error: {e}")
            return []

    async def extract_content_from_url(self, url, title):
        """URL'den içerik çeker"""
        try:
            await self.websocket.send_json({
                "type": "progress", 
                "step": 0.3, 
                "message": f"📖 {title[:50]}... sayfası okunuyor"
            })
            
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=10) as response:
                    if response.status == 200:
                        html = await response.text()
                        
                        # Basit HTML temizleme
                        try:
                            from bs4 import BeautifulSoup
                            soup = BeautifulSoup(html, 'html.parser')
                        except ImportError:
                            # BeautifulSoup yoksa basit text extract
                            import re
                            # HTML taglerini kaldır
                            text = re.sub('<[^<]+?>', '', html)
                            return text[:3000]
                        
                        # Script ve style etiketlerini kaldır
                        for script in soup(["script", "style"]):
                            script.decompose()
                        
                        # Text'i al
                        text = soup.get_text()
                        
                        # Satırları temizle
                        lines = (line.strip() for line in text.splitlines())
                        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                        text = ' '.join(chunk for chunk in chunks if chunk)
                        
                        # İlk 3000 karakteri al
                        return text[:3000]
            
        except Exception as e:
            logger.error(f"Content extraction error for {url}: {e}")
            return ""
        
        return ""

    async def research_topic(self, topic):
        """Gerçek deep research yapar"""
        
        await self.websocket.send_json({
            "type": "progress", 
            "step": 0.05, 
            "message": f"🚀 '{topic}' konusu için deep research başlıyor..."
        })
        
        # 1. Konu analizi ve arama sorguları oluştur
        current_date = datetime.now().strftime("%d %B %Y")
        analysis_prompt = f"""
Bu araştırma konusunu analiz et ve 5 farklı arama sorgusu öner:

Konu: {topic}

Bugünün tarihi: {current_date}
Güncel gelişmelere odaklan ve İngilizce arama sorguları üret.

Her arama sorgusu farklı bir açıdan konuya yaklaşmalı. Sadece arama sorgularını listele, başka açıklama yapma.
Format:
1. sorgu bir
2. sorgu iki
3. sorgu üç
4. sorgu dört  
5. sorgu beş
"""
        
        await self.websocket.send_json({
            "type": "progress", 
            "step": 0.1, 
            "message": "🧠 Araştırma stratejisi belirleniyor..."
        })
        
        try:
            logger.info(f"About to call call_local_model for analysis...")
            queries_text = await self.call_local_model(
                analysis_prompt, 
                "Sen araştırma uzmanısın. Verilen konular için etkili arama sorguları oluşturursun."
            )
            logger.info(f"call_local_model completed successfully")
        except Exception as e:
            logger.error(f"call_local_model failed: {e}")
            queries_text = "1. ana konu\n2. genel araştırma"
        
        # Sorguları parse et - duplikasyonları önle
        search_queries = []
        seen_queries = set()
        lines = queries_text.split('\n')
        for line in lines:
            line = line.strip()
            if line and (line[0].isdigit() or line.startswith('-')):
                # Numarayı kaldır
                query = line.split('.', 1)[-1].strip().lower()
                if query and query not in seen_queries and len(query) > 5:
                    search_queries.append(query)
                    seen_queries.add(query)
        
        # Fallback sorguları ekle
        if not search_queries:
            search_queries = [topic, f"{topic} nedir", f"{topic} hakkında"]
        
        # İlk 3 sorguyu kullan
        search_queries = search_queries[:3]
        
        # 2. Web araması yap
        all_search_results = []
        
        for i, query in enumerate(search_queries):
            await self.websocket.send_json({
                "type": "progress", 
                "step": 0.15 + (i * 0.15), 
                "message": f"🔍 Arama {i+1}/{len(search_queries)}: {query[:50]}..."
            })
            
            results = await self.search_web(query, max_results=3)
            all_search_results.extend(results)
            
            await asyncio.sleep(1)  # Rate limiting
        
        # 3. İçerikleri analiz et
        research_data = []
        
        for i, result in enumerate(all_search_results[:8]):  # İlk 8 sonuç
            await self.websocket.send_json({
                "type": "progress", 
                "step": 0.5 + (i * 0.05), 
                "message": f"📊 Kaynak analizi: {result['title'][:40]}..."
            })
            
            # İçerik çek
            if result['url']:
                content = await self.extract_content_from_url(result['url'], result['title'])
                result['content'] = content
            
            # Model ile analiz et
            if result.get('content') or result.get('body'):
                analysis_text = result.get('content', result.get('body', ''))
                
                analysis_prompt = f"""
Bu web kaynağındaki bilgileri analiz et ve '{topic}' konusu ile ilgili önemli bilgileri özetle:

Kaynak: {result['title']}
URL: {result['url']}

İçerik:
{analysis_text[:2000]}

Sadece konuyla ilgili önemli bilgileri özetle, kaynak adını da belirt.
"""
                
                analysis = await self.call_local_model(
                    analysis_prompt,
                    "Sen araştırma analistisin. Web kaynaklarındaki bilgileri özetlersin.",
                    max_tokens=500
                )
                
                if analysis and "hatası" not in analysis.lower():
                    research_data.append({
                        'source': result['title'],
                        'url': result['url'],
                        'analysis': analysis
                    })
        
        # 4. Final rapor oluştur
        await self.websocket.send_json({
            "type": "progress", 
            "step": 0.9, 
            "message": "📝 Comprehensive research report yazılıyor..."
        })
        
        # Tüm analiz sonuçlarını birleştir
        combined_research = "\n\n".join([
            f"**Kaynak: {item['source']}**\nURL: {item['url']}\n{item['analysis']}"
            for item in research_data
        ])
        
        # Eğer hiç araştırma verisi yoksa, model bilgisiyle fallback yap
        if not research_data:
            fallback_prompt = f"""
'{topic}' konusu hakkında mevcut bilgilerini kullanarak kapsamlı bir analiz yap:

- Temel tanım ve kavramlar
- Önemli özellikler ve karakteristikler
- Güncel durum ve gelişmeler
- Gelecek beklentileri
- Pratik uygulamalar

Detaylı ve bilgilendirici bir rapor hazırla.
"""
            fallback_research = await self.call_local_model(
                fallback_prompt,
                "Sen uzman araştırmacısısın. Konular hakkında kapsamlı analizler yaparsın.",
                max_tokens=2000
            )
            
            research_data.append({
                'source': 'AI Model Bilgi Tabanı',
                'url': 'N/A',
                'analysis': fallback_research
            })
            
            combined_research = f"**Kaynak: AI Model Bilgi Tabanı**\nURL: N/A\n{fallback_research}"
        
        final_prompt = f"""
Aşağıdaki araştırma sonuçlarını kullanarak '{topic}' konusu hakkında Türkçe kapsamlı bir rapor hazırla:

ARAŞTIRMA VERİLERİ:
{combined_research}

RAPOR İHTİYAÇLARI:
- Tamamen Türkçe yazılmış olması (hiç İngilizce kelime kullanma)
- Net giriş bölümü
- Ana bulgular ve önemli gelişmeler
- Detaylı analiz ve değerlendirmeler
- Sonuç ve gelecek öngörüleri  
- Markdown formatında düzenli yapı

Özellikle 2025 yılındaki gelişmelere odaklanarak güncel ve bilimsel bir rapor oluştur. Tüm metni Türkçe yaz.
"""
        
        final_report = await self.call_local_model(
            final_prompt,
            "Sen uzman araştırmacısısın. Web araştırması sonuçlarından kapsamlı, profesyonel raporlar yazarsın.",
            max_tokens=4000
        )
        
        # 5. Dosya kaydet
        await self.websocket.send_json({
            "type": "progress", 
            "step": 0.95, 
            "message": "💾 Rapor masaüstüne kaydediliyor..."
        })
        
        try:
            # Masaüstü yolu - host masaüstüne kaydet
            import os
            desktop_path = "/app/desktop"  # Docker'da host masaüstü mount edildi
            research_path = "/app/research_results"  # Container içi results
            
            os.makedirs(desktop_path, exist_ok=True)
            os.makedirs(research_path, exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            safe_topic = "".join(c for c in topic if c.isalnum() or c in (' ', '-', '_')).rstrip()[:50]
            filename = f"{timestamp}_{safe_topic.replace(' ', '_')}_deep_research.md"
            
            # Hem masaüstüne hem research_results'a kaydet
            desktop_filepath = os.path.join(desktop_path, filename)
            research_filepath = os.path.join(research_path, filename)
            
            report_header = f"""# Derin Araştırma Raporu: {topic}

**Araştırma Tarihi:** {datetime.now().strftime('%d %B %Y, %H:%M')}
**Araştırma Türü:** Web Tabanlı Derin Araştırma
**Kullanılan Model:** {self.model_name}
**Toplam Kaynak:** {len(research_data)} web kaynağı
**Arama Sorguları:** {len(search_queries)} farklı sorgu

---

"""
            
            source_list = "\n".join([
                f"- [{item['source']}]({item['url']})"
                for item in research_data
            ])
            
            full_report = report_header + final_report + f"\n\n## Kaynaklar\n\n{source_list}"
            
            # Masaüstüne kaydet
            try:
                with open(desktop_filepath, 'w', encoding='utf-8') as f:
                    f.write(full_report)
                await self.websocket.send_json({
                    "type": "progress", 
                    "step": 0.97, 
                    "message": f"✅ Rapor masaüstüne kaydedildi: {filename}"
                })
            except Exception as e:
                logger.error(f"Desktop save error: {e}")
            
            # Research results'a da kaydet
            try:
                with open(research_filepath, 'w', encoding='utf-8') as f:
                    f.write(full_report)
                await self.websocket.send_json({
                    "type": "progress", 
                    "step": 0.98, 
                    "message": f"✅ Yedek kopya da kaydedildi"
                })
            except Exception as e:
                logger.error(f"Research results save error: {e}")
            
        except Exception as e:
            final_report += f"\n\n**Not:** Dosya kaydetme hatası: {str(e)}"
        
        await self.websocket.send_json({
            "type": "progress", 
            "step": 1.0, 
            "message": "🎉 Deep research tamamlandı!"
        })
        
        return final_report