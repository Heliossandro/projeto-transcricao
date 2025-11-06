# app.py - versão corrigida
import os
import urllib.request
import zipfile
import shutil
from vosk import Model
from flask import Flask, render_template, request, jsonify
import json

def ensure_model():
    model_url = "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"
    model_dir = "vosk-model-small-pt-0.3"
    
    # Se já existe, verificar se está completo
    if os.path.exists(model_dir):
        # Verificar arquivo crítico G.carpa
        carpa_path = os.path.join(model_dir, "rescore", "G.carpa")
        if not os.path.exists(carpa_path) or os.path.getsize(carpa_path) < 1000000:  # menos de 1MB = provavelmente corrompido
            print("Modelo incompleto/corrompido, baixando novamente...")
            shutil.rmtree(model_dir)
        else:
            print("Modelo parece estar OK")
            return model_dir
    
    # Baixar modelo
    print("Baixando modelo de voz...")
    zip_file = "model-temp.zip"
    
    try:
        urllib.request.urlretrieve(model_url, zip_file)
        print("Extraindo...")
        
        with zipfile.ZipFile(zip_file, 'r') as zip_ref:
            zip_ref.extractall(".")
        
        os.remove(zip_file)
        print("Modelo pronto!")
        return model_dir
        
    except Exception as e:
        print(f"Erro no download: {e}")
        return None

# Garantir que o modelo existe
model_path = ensure_model()

if model_path is None:
    print("❌ Não foi possível obter o modelo")
    exit(1)

# Agora carregar o modelo
try:
    model = Model(model_path)
    print("✅ Modelo Vosk carregado com sucesso!")
except Exception as e:
    print(f"❌ Erro ao carregar modelo: {e}")
    exit(1)

# Resto do seu código Flask...
app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True)