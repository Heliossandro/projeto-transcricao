from flask import Flask, request, jsonify
from vosk import Model, KaldiRecognizer
from flask import render_template
import json
import os
import subprocess
import tempfile

app = Flask(__name__)

# Configurações
MODEL_PATH = "models/vosk-model-small-pt-0.3"

# Verificar se o modelo existe
if not os.path.exists(MODEL_PATH):
    print(f"❌ Modelo não encontrado em: {MODEL_PATH}")
    exit(1)

# Carregar modelo
try:
    model = Model(MODEL_PATH)
    rec = KaldiRecognizer(model, 16000)
    print("✅ Modelo Vosk carregado com sucesso!")
except Exception as e:
    print(f"❌ Erro ao carregar modelo: {e}")
    exit(1)

@app.route("/")
def home():
    return render_template("index.html")

@app.route("/health")
def health():
    return jsonify({"status": "healthy", "model": "loaded"})

@app.route("/stream", methods=["POST"])
def stream():
    temp_files = []
    
    try:
        print("🎤 Recebendo áudio...")
        
        # Obter dados de áudio
        if 'audio' in request.files:
            audio_file = request.files['audio']
            audio_data = audio_file.read()
        else:
            audio_data = request.data

        if not audio_data or len(audio_data) < 100:
            return jsonify({"original": "", "translated": "", "status": "no_audio"})

        print(f"📊 Áudio recebido: {len(audio_data)} bytes")

        # SALVAR arquivo temporário com extensão .webm
        temp_webm = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
        temp_webm.write(audio_data)
        temp_webm.close()
        temp_files.append(temp_webm.name)

        # CONVERTER usando FFmpeg - método CORRIGIDO
        try:
            # Primeiro: verificar o que temos
            probe_cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                temp_webm.name
            ]
            
            probe_result = subprocess.run(probe_cmd, capture_output=True, text=True)
            print(f"🔍 FFprobe resultado: {probe_result.returncode}")
            
            # Converter usando codec específico para WebM
            temp_pcm = tempfile.NamedTemporaryFile(delete=False, suffix=".pcm")
            temp_pcm.close()
            temp_files.append(temp_pcm.name)
            
            cmd = [
                'ffmpeg',
                '-y',  # Sobrescrever
                '-i', temp_webm.name,  # Arquivo de entrada
                '-acodec', 'pcm_s16le',  # Codec PCM
                '-ar', '16000',  # Taxa de amostragem
                '-ac', '1',  # Mono
                '-f', 's16le',  # Formato
                temp_pcm.name  # Arquivo de saída
            ]
            
            print(f"🔄 Executando: {' '.join(cmd)}")
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode != 0:
                print(f"❌ FFmpeg erro: {result.stderr}")
                # Tentar método alternativo
                return process_with_alternative_method(audio_data)
            
            # Ler arquivo convertido
            with open(temp_pcm.name, "rb") as f:
                pcm_data = f.read()
                
            print(f"✅ Conversão OK: {len(pcm_data)} bytes PCM")
            
        except Exception as e:
            print(f"❌ Erro na conversão: {e}")
            return process_with_alternative_method(audio_data)

        # RECONHECIMENTO de voz
        text = ""
        is_partial = False
        
        if len(pcm_data) > 1000:
            if rec.AcceptWaveform(pcm_data):
                result_data = json.loads(rec.Result())
                text = result_data.get("text", "").strip()
                is_partial = False
                print(f"✅ Texto final: '{text}'")
            else:
                result_data = json.loads(rec.PartialResult())
                text = result_data.get("partial", "").strip()
                is_partial = True
                print(f"🔄 Texto parcial: '{text}'")
        else:
            print("❌ Dados PCM insuficientes")

        # TRADUÇÃO
        translated = translate_text(text) if text else ""

        return jsonify({
            "original": text,
            "translated": translated,
            "status": "success" if text else "no_speech",
            "is_partial": is_partial
        })

    except Exception as e:
        print(f"💥 ERRO: {e}")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "original": "",
            "translated": "",
            "status": "error"
        }), 500
        
    finally:
        # LIMPAR arquivos temporários
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except:
                pass

def process_with_alternative_method(audio_data):
    """Método alternativo se a conversão direta falhar"""
    print("🔄 Tentando método alternativo...")
    
    temp_files = []
    
    try:
        # Salvar como WAV diretamente (pular WebM)
        temp_wav = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
        temp_files.append(temp_wav.name)
        
        # Tentar converter diretamente para WAV
        cmd = [
            'ffmpeg',
            '-y',
            '-f', 'webm',  # Forçar formato de entrada
            '-i', 'pipe:0',  # Entrada do pipe
            '-ar', '16000',
            '-ac', '1',
            '-f', 'wav',
            temp_wav.name
        ]
        
        result = subprocess.run(cmd, input=audio_data, capture_output=True, timeout=10)
        
        if result.returncode == 0 and os.path.exists(temp_wav.name):
            # Converter WAV para PCM
            temp_pcm = tempfile.NamedTemporaryFile(delete=False, suffix=".pcm")
            temp_files.append(temp_pcm.name)
            
            cmd2 = [
                'ffmpeg',
                '-y',
                '-i', temp_wav.name,
                '-ar', '16000',
                '-ac', '1',
                '-f', 's16le',
                temp_pcm.name
            ]
            
            result2 = subprocess.run(cmd2, capture_output=True, timeout=10)
            
            if result2.returncode == 0:
                with open(temp_pcm.name, "rb") as f:
                    pcm_data = f.read()
                
                # Reconhecimento
                if len(pcm_data) > 1000:
                    if rec.AcceptWaveform(pcm_data):
                        result_data = json.loads(rec.Result())
                        text = result_data.get("text", "").strip()
                    else:
                        result_data = json.loads(rec.PartialResult())
                        text = result_data.get("partial", "").strip()
                    
                    translated = translate_text(text) if text else ""
                    
                    return jsonify({
                        "original": text,
                        "translated": translated,
                        "status": "success" if text else "no_speech",
                        "is_partial": False
                    })
        
        # Se tudo falhar, usar fallback
        return fallback_response()
        
    except Exception as e:
        print(f"❌ Método alternativo falhou: {e}")
        return fallback_response()
        
    finally:
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except:
                pass

def translate_text(text):
    """Tradução simples"""
    translation_map = {
        "olá": "hello",
        "oi": "hi", 
        "bom dia": "good morning",
        "boa tarde": "good afternoon",
        "boa noite": "good night",
        "como estás": "how are you",
        "obrigado": "thank you",
        "obrigada": "thank you",
        "adeus": "goodbye",
        "sim": "yes",
        "não": "no"
    }
    
    text_lower = text.lower()
    for pt, en in translation_map.items():
        if pt in text_lower:
            return en
    
    return f"[translated: {text}]"

def fallback_response():
    """Resposta de fallback"""
    return jsonify({
        "original": "fale claramente por favor",
        "translated": "please speak clearly",
        "status": "fallback"
    })

if __name__ == "__main__":
    print("🚀 Servidor iniciando na porta 5000...")
    app.run(debug=True, host='0.0.0.0', port=5000)