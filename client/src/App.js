import React, { useState, useRef, useEffect } from 'react';

const App = () => {
  // State variables
  const [input, setInput] = useState('');
  const [lastUserInput, setLastUserInput] = useState('');
  const [reply, setReply] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);
  const utteranceRef = useRef(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);

  useEffect(() => {
    // Loads available Indian English voices from the browser
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const indianVoices = allVoices.filter(
        (voice) => voice.lang === 'en-IN'
      );
      setVoices(indianVoices);
      setSelectedVoice(indianVoices[0] || null);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Updates input state as the user types
  const handleInputChange = (e) => setInput(e.target.value);

  // Sends user input to backend and processes response
  const handleSend = async () => {
    if (!input.trim()) return;
    setLastUserInput(input);
    await fetchReply(input);
    setInput('');
  };

  // Calls backend API and triggers text-to-speech
  const fetchReply = async (inputText) => {
    try {
      const response = await fetch('http://localhost:5000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: inputText }),
      });
      const data = await response.json();

      const htmlFormatted = formatReplyToHTML(data.reply);
      setReply(htmlFormatted);

      const cleanSpeech = stripMarkdown(data.reply);

      // Cancel any existing speech before speaking new response
      window.speechSynthesis.cancel();

      utteranceRef.current = new SpeechSynthesisUtterance(cleanSpeech);
      if (selectedVoice) utteranceRef.current.voice = selectedVoice;

      utteranceRef.current.onend = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utteranceRef.current);
      setIsSpeaking(true);
    } catch (error) {
      console.error('Error fetching reply:', error);
    }
  };

  // Removes markdown and HTML tags for clean speech output
  const stripMarkdown = (text) => {
    return text
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/#+ /g, '')
      .replace(/<\/?[^>]+(>|$)/g, '');
  };

  // Converts markdown to basic HTML for rendering response
  const formatReplyToHTML = (text) => {
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/\n\* (.*?)(?=\n|$)/g, '<li>$1</li>');
    formatted = formatted.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    formatted = formatted.replace(/\n(?=[^<])/g, '<br/>');
    return formatted;
  };

  // Starts or stops voice recognition for user speech input
  const handleMic = () => {
    if (!recognitionRef.current) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-IN';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setLastUserInput(transcript);
        fetchReply(transcript);
        setListening(false);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setListening(false);
      };

      recognitionRef.current.onend = () => {
        setListening(false);
      };
    }

    if (!listening) {
      recognitionRef.current.start();
      setListening(true);
    } else {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  // Pauses or resumes text-to-speech playback
  const handlePauseSpeech = () => {
    if (window.speechSynthesis.speaking) {
      if (isSpeaking) {
        window.speechSynthesis.pause();
        setIsSpeaking(false);
      } else {
        window.speechSynthesis.resume();
        setIsSpeaking(true);
      }
    }
  };

  // Updates selected voice for speech synthesis
  const handleVoiceChange = (e) => {
    const selected = voices.find((v) => v.name === e.target.value);
    setSelectedVoice(selected);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🤖 Voice + Text Assistant</h1>

      <div style={{ marginBottom: '10px' }}>
        <input
          type="text"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask something..."
          style={{ padding: '10px', width: '300px', marginRight: '10px' }}
        />
        <button onClick={handleSend}>Send</button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <button onClick={handleMic}>
          🎙 {listening ? 'Stop Listening' : 'Start Voice Input'}
        </button>
        <button onClick={handlePauseSpeech} style={{ marginLeft: '10px' }}>
          ⏯ {isSpeaking ? 'Pause' : 'Resume'}
        </button>
      </div>

      {voices.length > 0 && (
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="voice-select">Voice: </label>
          <select id="voice-select" onChange={handleVoiceChange} value={selectedVoice?.name || ''}>
            {voices.map((voice, idx) => (
              <option key={idx} value={voice.name}>
                {voice.name} ({voice.gender || 'Voice'})
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <p><strong>You:</strong> {lastUserInput}</p>
        <p><strong>Assistant:</strong></p>
        <div dangerouslySetInnerHTML={{ __html: reply }} />
      </div>
    </div>
  );
};

export default App;
