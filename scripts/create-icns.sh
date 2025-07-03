#!/bin/bash

# PNG'den ICNS oluştur
create_icns_from_png() {
    local png_file="$1"
    local icns_file="$2"
    
    if [ ! -f "$png_file" ]; then
        echo "PNG dosyası bulunamadı: $png_file"
        return 1
    fi
    
    # Geçici iconset klasörü oluştur
    local iconset_dir="${png_file%.*}.iconset"
    mkdir -p "$iconset_dir"
    
    # Farklı boyutlarda iconlar oluştur
    sips -z 16 16     "$png_file" --out "$iconset_dir/icon_16x16.png"
    sips -z 32 32     "$png_file" --out "$iconset_dir/icon_16x16@2x.png"
    sips -z 32 32     "$png_file" --out "$iconset_dir/icon_32x32.png"
    sips -z 64 64     "$png_file" --out "$iconset_dir/icon_32x32@2x.png"
    sips -z 128 128   "$png_file" --out "$iconset_dir/icon_128x128.png"
    sips -z 256 256   "$png_file" --out "$iconset_dir/icon_128x128@2x.png"
    sips -z 256 256   "$png_file" --out "$iconset_dir/icon_256x256.png"
    sips -z 512 512   "$png_file" --out "$iconset_dir/icon_256x256@2x.png"
    sips -z 512 512   "$png_file" --out "$iconset_dir/icon_512x512.png"
    sips -z 1024 1024 "$png_file" --out "$iconset_dir/icon_512x512@2x.png"
    
    # ICNS oluştur
    iconutil -c icns "$iconset_dir" -o "$icns_file"
    
    # Temizlik
    rm -rf "$iconset_dir"
    
    echo "ICNS oluşturuldu: $icns_file"
}

# Ana fonksiyon
if [ "$#" -eq 2 ]; then
    create_icns_from_png "$1" "$2"
else
    echo "Kullanım: $0 <input.png> <output.icns>"
    exit 1
fi

