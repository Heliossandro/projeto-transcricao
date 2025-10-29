from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
import os

app = Flask(__name__)

# rota da página principal
@app.route('/')
def index():
    return render_template('index.html')

# rota que recebe o áudio
@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    # salvar o arquivo de áudio temporariamente
    audio_file = request.files['audio']
    file_path = "audio_temp.wav"
    audio_file.save(file_path)

    # criar o reconhecedor
    recognizer = sr.Recognizer()
    with sr.AudioFile(file_path) as source:
        audio_data = recognizer.record(source)
        try:
            texto = recognizer.recognize_google(audio_data, language='pt-PT')
        except sr.UnknownValueError:
            texto = "Não consegui entender o áudio."
        except sr.RequestError:
            texto = "Erro de conexão com o serviço de reconhecimento."

    # apagar o arquivo de áudio temporário
    os.remove(file_path)

    return jsonify({'texto': texto})

if __name__ == '__main__':
    app.run(debug=True)
