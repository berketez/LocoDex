
import os
import argparse
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import PeftModel

def merge_and_save_model(base_model_path, lora_adapter_path, output_path):
    """LoRA adaptörlerini temel modelle birleştirir ve sonucu kaydeder."""
    print(f"--- LoRA Birleştirme Başlatılıyor ---")
    print(f"Temel model yükleniyor: {base_model_path}")

    # Temel modeli yükle
    base_model = AutoModelForCausalLM.from_pretrained(
        base_model_path,
        return_dict=True,
        torch_dtype=torch.float16,
        device_map='auto',
    )

    # Tokenizer'ı yükle
    tokenizer = AutoTokenizer.from_pretrained(base_model_path)

    # LoRA adaptörünü temel modelle birleştir
    print(f"LoRA adaptörü yükleniyor: {lora_adapter_path}")
    model_to_merge = PeftModel.from_pretrained(base_model, lora_adapter_path)
    merged_model = model_to_merge.merge_and_unload()
    print("Model başarıyla birleştirildi.")

    # Birleştirilmiş modeli ve tokenizer'ı kaydet
    os.makedirs(output_path, exist_ok=True)
    merged_model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)
    print(f"Birleştirilmiş model şuraya kaydedildi: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LoRA adaptörlerini temel modelle birleştir.")
    parser.add_argument("--base_model", type=str, required=True, help="Temel modelin yolu veya Hugging Face ID'si.")
    parser.add_argument("--lora_adapter", type=str, required=True, help="Eğitilmiş LoRA adaptörlerinin yolu.")
    parser.add_argument("--output_path", type=str, required=True, help="Birleştirilmiş modelin kaydedileceği yol.")

    args = parser.parse_args()
    merge_and_save_model(args.base_model, args.lora_adapter, args.output_path)
