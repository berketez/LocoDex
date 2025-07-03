#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LocoDex Modern App Icon Generator
macOS Big Sur/Monterey/Sonoma tarzı modern app icon oluşturur
"""

import os
import sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

def create_modern_icon(size=1024):
    """Modern macOS app icon oluştur"""
    # Ana arka plan
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Modern rounded rectangle (macOS Big Sur tarzı)
    corner_radius = size // 4.5  # ~22% corner radius
    
    # Gradient arka plan
    gradient_image = create_gradient_background(size)
    
    # Mask oluştur
    mask = Image.new('L', (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([(0, 0), (size, size)], radius=corner_radius, fill=255)
    
    # Gradient'i mask ile uygula
    icon_bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    icon_bg.paste(gradient_image, (0, 0))
    icon_bg.putalpha(mask)
    
    # Ana simgeyi ekle
    icon_with_symbol = add_logo_symbol(icon_bg, size)
    
    # Modern efektler ekle
    final_icon = add_modern_effects(icon_with_symbol, size)
    
    return final_icon

def create_gradient_background(size):
    """Modern gradient arka plan"""
    image = Image.new('RGB', (size, size), '#3498db')
    draw = ImageDraw.Draw(image)
    
    # Çoklu gradient (mavi tonları)
    center_x, center_y = size // 2, size // 2
    max_distance = math.sqrt(center_x**2 + center_y**2)
    
    for y in range(size):
        for x in range(size):
            # Merkeze uzaklık
            distance = math.sqrt((x - center_x)**2 + (y - center_y)**2)
            ratio = distance / max_distance
            
            # Renk hesaplama
            if ratio < 0.3:
                # Merkez: parlak mavi
                r = int(52 + (74 - 52) * (ratio / 0.3))
                g = int(152 + (144 - 152) * (ratio / 0.3))
                b = int(219 + (226 - 219) * (ratio / 0.3))
            elif ratio < 0.7:
                # Orta: gradient
                local_ratio = (ratio - 0.3) / 0.4
                r = int(74 + (41 - 74) * local_ratio)
                g = int(144 + (128 - 144) * local_ratio)
                b = int(226 + (185 - 226) * local_ratio)
            else:
                # Kenar: koyu mavi
                local_ratio = (ratio - 0.7) / 0.3
                r = int(41 + (30 - 41) * local_ratio)
                g = int(128 + (100 - 128) * local_ratio)
                b = int(185 + (150 - 185) * local_ratio)
            
            # Pixel'i ayarla
            if x < size and y < size:
                draw.point((x, y), fill=(r, g, b))
    
    return image

def add_logo_symbol(image, size):
    """LocoDex logo sembolü ekle"""
    draw = ImageDraw.Draw(image)
    
    # Sembol boyutları
    symbol_size = size // 2
    symbol_x = (size - symbol_size) // 2
    symbol_y = (size - symbol_size) // 2
    
    # Beyaz arka plan daire
    circle_radius = symbol_size // 2
    circle_center = (size // 2, size // 2)
    
    # Yumuşak beyaz daire
    circle_bg = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    circle_draw = ImageDraw.Draw(circle_bg)
    
    # Ana daire
    circle_draw.ellipse([
        (circle_center[0] - circle_radius, circle_center[1] - circle_radius),
        (circle_center[0] + circle_radius, circle_center[1] + circle_radius)
    ], fill=(255, 255, 255, 220), outline=(255, 255, 255, 100), width=4)
    
    # Blur efekti
    circle_bg = circle_bg.filter(ImageFilter.GaussianBlur(radius=2))
    
    # Ana görüntüye uygula
    image = Image.alpha_composite(image, circle_bg)
    draw = ImageDraw.Draw(image)
    
    # "L" harfi (LocoDex için)
    letter_size = symbol_size // 2
    letter_x = circle_center[0] - letter_size // 4
    letter_y = circle_center[1] - letter_size // 2
    
    # L harfinin kalınlığı
    stroke_width = max(8, size // 64)
    
    # Dikey çizgi
    draw.rectangle([
        (letter_x, letter_y),
        (letter_x + stroke_width, letter_y + letter_size)
    ], fill=(52, 152, 219))
    
    # Yatay çizgi
    draw.rectangle([
        (letter_x, letter_y + letter_size - stroke_width),
        (letter_x + letter_size // 2, letter_y + letter_size)
    ], fill=(52, 152, 219))
    
    # Küçük nokta (modern dokunuş)
    dot_size = stroke_width // 2
    dot_x = letter_x + letter_size // 2 + stroke_width
    dot_y = letter_y + letter_size // 3
    
    draw.ellipse([
        (dot_x, dot_y),
        (dot_x + dot_size, dot_y + dot_size)
    ], fill=(231, 76, 60))
    
    return image

def add_modern_effects(image, size):
    """Modern görsel efektler"""
    # Subtle shadow
    shadow = Image.new('RGBA', (size + 20, size + 20), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    
    # Shadow için rounded rectangle
    corner_radius = size // 4.5
    shadow_draw.rounded_rectangle([
        (10, 15), (size + 10, size + 15)
    ], radius=corner_radius, fill=(0, 0, 0, 30))
    
    # Blur shadow
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))
    
    # Final composition
    final = Image.new('RGBA', (size + 20, size + 20), (0, 0, 0, 0))
    final.paste(shadow, (0, 0))
    final.paste(image, (10, 5), image)
    
    # Crop back to original size
    final = final.crop((10, 5, size + 10, size + 5))
    
    return final

def create_icon_set(base_size=1024, output_dir='assets'):
    """Farklı boyutlarda icon set oluştur"""
    print(f"🎨 Modern app icon set oluşturuluyor...")
    
    # Output klasörünü oluştur
    os.makedirs(output_dir, exist_ok=True)
    
    # Ana icon oluştur
    base_icon = create_modern_icon(base_size)
    
    # Farklı boyutlar
    sizes = [16, 32, 64, 128, 256, 512, 1024]
    
    for size in sizes:
        if size == base_size:
            icon = base_icon
        else:
            # Resize with high quality
            icon = base_icon.resize((size, size), Image.Resampling.LANCZOS)
        
        # PNG olarak kaydet
        png_path = os.path.join(output_dir, f'icon-{size}.png')
        icon.save(png_path, 'PNG', quality=95, optimize=True)
        print(f"✅ {size}x{size} icon oluşturuldu: {png_path}")
    
    # Ana icon dosyası
    main_icon_path = os.path.join(output_dir, 'icon.png')
    base_icon.save(main_icon_path, 'PNG', quality=95, optimize=True)
    print(f"✅ Ana icon oluşturuldu: {main_icon_path}")
    
    return main_icon_path

def create_icns_file(png_path, icns_path):
    """PNG'den ICNS dosyası oluştur (macOS'ta)"""
    try:
        import subprocess
        
        # sips komutu ile ICNS oluştur
        result = subprocess.run([
            'sips', '-s', 'format', 'icns', png_path, '--out', icns_path
        ], capture_output=True, text=True)
        
        if result.returncode == 0:
            print(f"✅ ICNS dosyası oluşturuldu: {icns_path}")
            return True
        else:
            print(f"⚠️  ICNS oluşturma başarısız: {result.stderr}")
            return False
    except Exception as e:
        print(f"⚠️  ICNS oluşturma hatası: {e}")
        return False

if __name__ == "__main__":
    # Komut satırı argümanları
    if len(sys.argv) > 1:
        output_dir = sys.argv[1]
    else:
        output_dir = 'assets'
    
    try:
        # Icon set oluştur
        main_icon_path = create_icon_set(output_dir=output_dir)
        
        # ICNS dosyası oluşturmayı dene (sadece macOS'ta çalışır)
        icns_path = os.path.join(output_dir, 'icon.icns')
        create_icns_file(main_icon_path, icns_path)
        
        print("🎉 Modern app icon set oluşturma tamamlandı!")
        
    except Exception as e:
        print(f"❌ Hata: {e}")
        sys.exit(1)

