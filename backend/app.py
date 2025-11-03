from flask import Flask, render_template, request, jsonify
import speech_recognition as sr
from googletrans import Translator
from pydub import AudioSegment
import os

app = Flask(__name__)

# instância do tradutor
translator = Translator()

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/translate_audio', methods=['POST'])
def translate_audio():
    """Recebe o áudio, reconhece fala e traduz"""
    source_lang = request.form.get('source_lang', 'pt-PT')
    target_lang = request.form.get('target_lang', 'en')

    # salva o áudio temporariamente
    audio_file = request.files['audio']
    file_path = "audio_temp.wav"
    audio_file.save(file_path)

    # converte o áudio para WAV PCM linear (necessário para speech_recognition)
    try:
        sound = AudioSegment.from_file(file_path)
        sound.export(file_path, format="wav", parameters=["-acodec", "pcm_s16le"])
    except Exception as e:
        return jsonify({'error': f'Erro ao converter áudio: {str(e)}'})

    # cria o reconhecedor
    recognizer = sr.Recognizer()

    with sr.AudioFile(file_path) as source:
        audio_data = recognizer.record(source)

        try:
            # converte fala em texto
            text = recognizer.recognize_google(audio_data, language=source_lang)
            # traduz o texto
            translated = translator.translate(text, src=source_lang.split('-')[0], dest=target_lang)
            translated_text = translated.text
        except sr.UnknownValueError:
            text = "Não consegui entender o áudio."
            translated_text = ""
        except sr.RequestError:
            text = "Erro ao conectar com o serviço de reconhecimento."
            translated_text = ""
        except Exception as e:
            text = f"Erro: {str(e)}"
            translated_text = ""

    # apaga o arquivo temporário
    os.remove(file_path)

    return jsonify({
        'original': text,
        'traduzido': translated_text
    })


if __name__ == '__main__':
    app.run(debug=True)
