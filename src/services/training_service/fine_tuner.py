import os
import argparse
import json
import torch
from datasets import load_dataset
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    BitsAndBytesConfig,
    TrainingArguments,
)
from peft import LoraConfig, PeftModel
from trl import SFTTrainer

def format_instruction(sample):
    return f"""### Instruction:
{sample['instruction']}

### Input:
{sample['input']}

### Response:
{sample['output']}"""

def fine_tune_with_qlora(base_model, dataset_path, output_path, training_config):
    """QLoRA kullanarak bir modeli talimatlarla ince ayarlar."""
    print("--- QLoRA İnce Ayar Süreci Başlatılıyor ---")

    # 1. Veri Kümesini Yükle ve Formatla
    print(f"Veri kümesi yükleniyor: {dataset_path}")
    dataset = load_dataset('json', data_files=dataset_path, split='train')
    
    # 2. Model ve Tokenizer'ı Yükle (4-bit Quantization ile)
    print(f"Temel model yükleniyor: {base_model}")
    quant_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.float16,
        bnb_4bit_use_double_quant=False,
    )

    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        quantization_config=quant_config,
        device_map="auto", # Otomatik olarak GPU'ya yerleştir
    )
    model.config.use_cache = False
    model.config.pretraining_tp = 1

    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    # 3. PEFT (LoRA) Konfigürasyonunu Ayarla
    peft_config = LoraConfig(
        lora_alpha=training_config.get('lora_alpha', 16),
        lora_dropout=training_config.get('lora_dropout', 0.1),
        r=training_config.get('lora_r', 64),
        bias="none",
        task_type="CAUSAL_LM",
    )

    # 4. Eğitim Argümanlarını Ayarla
    args = TrainingArguments(
        output_dir=output_path,
        num_train_epochs=training_config.get('epochs', 1),
        per_device_train_batch_size=training_config.get('batch_size', 4),
        gradient_accumulation_steps=training_config.get('gradient_accumulation_steps', 1),
        optim="paged_adamw_32bit",
        save_steps=training_config.get('save_steps', 25),
        logging_steps=training_config.get('logging_steps', 25),
        learning_rate=training_config.get('learning_rate', 2e-4),
        weight_decay=0.001,
        fp16=False,
        bf16=False,
        max_grad_norm=0.3,
        max_steps=-1,
        warmup_ratio=0.03,
        group_by_length=True,
        lr_scheduler_type="constant",
        report_to="tensorboard"
    )

    # 5. SFTTrainer'ı Oluştur
    trainer = SFTTrainer(
        model=model,
        train_dataset=dataset,
        peft_config=peft_config,
        dataset_text_field="text", # Veri kümesi formatına göre ayarlanacak
        max_seq_length=training_config.get('max_seq_length', 512),
        tokenizer=tokenizer,
        args=args,
        formatting_func=format_instruction, # Talimat formatlama fonksiyonu
    )

    # 6. Eğitimi Başlat
    print("\n--- Eğitim Başlıyor ---")
    trainer.train()
    print("--- Eğitim Tamamlandı ---")

    # 7. Eğitilmiş Adaptörleri Kaydet
    trainer.model.save_pretrained(output_path)
    print(f"Eğitilmiş LoRA adaptörleri şuraya kaydedildi: {output_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QLoRA ile bir AI modelini ince ayarla.")
    parser.add_argument("--base_model", type=str, required=True, help="İnce ayar için temel model (Hugging Face ID).")
    parser.add_argument("--dataset_path", type=str, required=True, help="JSONL formatında eğitim veri kümesinin yolu.")
    parser.add_argument("--output_path", type=str, required=True, help="Ayarlanmış LoRA adaptörlerinin kaydedileceği yol.")
    parser.add_argument("--config", type=str, required=True, help="JSON formatında eğitim konfigürasyonu.")

    args = parser.parse_args()
    
    try:
        training_config = json.loads(args.config)
        fine_tune_with_qlora(args.base_model, args.dataset_path, args.output_path, training_config)
    except Exception as e:
        print(f"Bir hata oluştu: {e}")
        exit(1)
