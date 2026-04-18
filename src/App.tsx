/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, 
  Volume2, 
  Share2, 
  Send, 
  Copy, 
  Check, 
  Radio, 
  Power,
  MessageCircle,
  Mail,
  Zap,
  ExternalLink,
  Shield,
  Activity,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface AudioDevice {
  deviceId: string;
  label: string;
}

export default function App() {
  // --- State ---
  const [audioDevices, setAudioDevices] = useState<AudioDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [audioLevel, setAudioLevel] = useState(0);
  const [gain, setGain] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const [pushId, setPushId] = useState('');
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // --- Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- Initialization ---
  useEffect(() => {
    // Generate a strictly URL-safe alphanumeric ID
    const randomId = Math.random().toString(36).substring(2, 12).toUpperCase();
    setPushId(`RX${randomId}`);
    
    const init = async () => {
      await refreshDevices();
      setIsInitializing(false);
    };
    init();

    return () => stopAudio();
  }, []);

  const resumeAudioContext = async () => {
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const refreshDevices = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({ deviceId: d.deviceId, label: d.label || `Mic Input ${d.deviceId.slice(0, 4)}` }));
      
      setAudioDevices(mics);
      if (mics.length > 0 && !selectedDevice) {
        setSelectedDevice(mics[0].deviceId);
      }
      stream.getTracks().forEach(t => t.stop());
    } catch (err) {
      console.error('Device listing error:', err);
      setError('Check microphone permissions in your browser settings.');
    }
  };

  const startAudio = async (deviceId: string) => {
    try {
      stopAudio();
      
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 2,
          sampleRate: 48000
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const gainNode = audioCtx.createGain();
      const analyser = audioCtx.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      gainNode.gain.value = gain;

      source.connect(gainNode);
      gainNode.connect(analyser);

      sourceRef.current = source;
      gainNodeRef.current = gainNode;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const scaledLevel = Math.pow(average / 140, 1.4) * 100;
        setAudioLevel(Math.min(100, scaledLevel));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      setIsLive(true);
      setError(null);
    } catch (err) {
      console.error('Start audio error:', err);
      setError('Hardware initialization failed. Reset power switch.');
      setIsLive(false);
    }
  };

  const stopAudio = () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioContextRef.current) audioContextRef.current.close();
    
    streamRef.current = null;
    audioContextRef.current = null;
    sourceRef.current = null;
    gainNodeRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const togglePower = async () => {
    await resumeAudioContext();
    if (isLive) {
      stopAudio();
      setIsLive(false);
    } else {
      await startAudio(selectedDevice);
    }
  };

  const handleGainChange = (newGain: number) => {
    setGain(newGain);
    if (gainNodeRef.current && audioContextRef.current) {
      gainNodeRef.current.gain.setTargetAtTime(newGain, audioContextRef.current.currentTime, 0.05);
    }
  };

  const generateNinjaUrl = () => {
    // Optimized VDO.Ninja URL for immediate connection
    const baseUrl = 'https://vdo.ninja/';
    const params = new URLSearchParams({
      push: pushId,
      proaudio: '1',
      audiobitrate: '256',
      stereo: '1',
      aec: '0',
      ag: '0',
      dn: '0',
      autostart: '1',
      label: 'REVOX_ENGINE',
      cleanoutput: '1',
      webcam: '0',
      buffer: '200' // Small buffer helps stabilize initial connection
    });
    return `${baseUrl}?${params.toString()}`;
  };

  const getViewerUrl = () => {
    return `https://vdo.ninja/?view=${pushId}&stereo=1&proaudio=1&autostart=1&buffer=200`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getViewerUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareVia = (platform: 'whatsapp' | 'telegram' | 'email') => {
    const text = `Live High-Fidelity Feed: ${getViewerUrl()}`;
    const encodedText = encodeURIComponent(text);
    
    let url = '';
    switch (platform) {
      case 'whatsapp': url = `https://wa.me/?text=${encodedText}`; break;
      case 'telegram': url = `https://t.me/share/url?url=${getViewerUrl()}&text=${encodeURIComponent('Join my high-fidelity stream')}`; break;
      case 'email': url = `mailto:?subject=Audio Stream Invitation&body=${encodedText}`; break;
    }
    window.open(url, '_blank');
  };

  const handleLaunch = () => {
    // VDO.Ninja handles device acquisition better when local capture is off
    stopAudio();
    setIsLive(false);
    window.open(generateNinjaUrl(), '_blank');
  };

  return (
    <div className="min-h-svh bg-[#050608] flex items-center justify-center p-0 md:p-6 font-sans text-blue-50/90 selection:bg-blue-500/30 overflow-hidden">
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full h-full md:h-auto md:max-w-xl md:min-h-[700px] bg-[#0C1016] md:rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] border-x md:border-y border-blue-500/10 flex flex-col relative"
      >
        {/* Neon Accent */}
        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-blue-400 to-transparent blur-[1px] opacity-40" />
        
        <div className="flex-1 flex flex-col p-6 md:p-10 overflow-y-auto no-scrollbar">
          
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-10 md:mb-14">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                <h1 className="text-3xl font-black tracking-tighter text-blue-50">
                  REVOX <span className="font-thin opacity-50">TX</span>
                </h1>
              </div>
              <p className="text-[9px] font-mono tracking-[0.3em] text-blue-400/40 uppercase mt-1">
                Aero-Blue Precision Engine
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={togglePower}
              className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-700 ${
                isLive 
                ? 'bg-blue-600 shadow-[0_0_40px_rgba(37,99,235,0.4)] border-blue-400' 
                : 'bg-white/[0.03] border-white/5 grayscale'
              } border`}
            >
              <Power className={`w-8 h-8 transition-all duration-700 ${isLive ? 'text-white' : 'text-blue-500/20'}`} />
              {isLive && (
                <motion.div 
                  animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 rounded-full border-2 border-blue-400" 
                />
              )}
            </motion.button>
          </div>

          {/* Monitoring Stats */}
          <div className="grid grid-cols-2 gap-4 mb-10">
            <div className="bg-blue-500/[0.03] border border-blue-500/10 p-5 rounded-3xl group transition-all hover:bg-blue-500/[0.06]">
              <span className="text-[7px] font-mono text-blue-400/30 uppercase tracking-[0.2em] mb-2 block">Link Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]' : 'bg-white/5'}`} />
                <span className={`text-xs font-bold tracking-tight uppercase ${isLive ? 'text-blue-100' : 'text-blue-400/20'}`}>
                  {isLive ? 'Transmitting' : 'Idle Engine'}
                </span>
              </div>
            </div>
            <div className="bg-blue-500/[0.03] border border-blue-500/10 p-5 rounded-3xl overflow-hidden">
              <span className="text-[7px] font-mono text-blue-400/30 uppercase tracking-[0.2em] mb-2 block">System Patch</span>
              <span className="text-xs font-mono text-blue-200/60 truncate block">{pushId}</span>
            </div>
          </div>

          {/* Controls Container */}
          <div className="space-y-8 flex-1">
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2 text-blue-400/40">
                  <Mic className="w-3 h-3" />
                  <span className="text-[8px] font-mono uppercase tracking-widest">Master Input Selection</span>
                </div>
              </div>
              <div className="relative">
                <select
                  value={selectedDevice}
                  onChange={(e) => {
                    setSelectedDevice(e.target.value);
                    if (isLive) startAudio(e.target.value);
                  }}
                  className="w-full bg-white/[0.03] border border-white/5 px-5 py-5 rounded-[22px] text-sm font-medium focus:outline-none focus:border-blue-500/50 appearance-none text-blue-100/70 transition-colors"
                >
                  <option value="" disabled>Hardware Device Required</option>
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId} className="bg-[#0C1016]">{d.label}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-blue-400/20">
                  <Settings className="w-3 h-3" />
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] p-8 rounded-[36px] border border-white/5 relative group">
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2 text-blue-400/40">
                  <Volume2 className="w-4 h-4" />
                  <span className="text-[8px] font-mono uppercase tracking-widest">Active Gain Stage</span>
                </div>
                <div className="font-mono text-xs text-blue-400 px-3 py-1 bg-blue-500/10 rounded-full border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  +{Math.round((gain - 1) * 20)} DB
                </div>
              </div>

              {/* Advanced Slider */}
              <div className="relative h-20 flex flex-col justify-center mb-4">
                <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]"
                    style={{ width: `${(gain / 2) * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={gain}
                  onChange={(e) => handleGainChange(parseFloat(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <motion.div 
                  className="absolute w-12 h-12 bg-[#0C1016] border-2 border-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.4)] flex items-center justify-center pointer-events-none"
                  style={{ left: `calc(${(gain / 2) * 100}% - 24px)` }}
                >
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                </motion.div>
              </div>

              {/* Ultra-Precision VU */}
              <div className="pt-6 border-t border-white/5 space-y-4">
                <div className="flex justify-between items-center px-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3 text-blue-500/40" />
                    <span className="text-[8px] font-mono text-blue-400/20 uppercase tracking-widest">IO Peak Level</span>
                  </div>
                  <div className="flex gap-4">
                    <span className="text-[6px] font-mono text-blue-400/10">INF</span>
                    <span className="text-[6px] font-mono text-blue-400/10">-18</span>
                    <span className="text-[6px] font-mono text-blue-400/10">-6</span>
                    <span className="text-[6px] font-mono text-blue-500/40">0 DB</span>
                  </div>
                </div>
                
                <div className="h-6 bg-black/40 rounded-xl p-1.5 flex gap-[3px] overflow-hidden border border-white/5">
                  {Array.from({ length: 60 }).map((_, i) => {
                    const threshold = (i / 60) * 100;
                    const isActive = audioLevel > threshold;
                    
                    let barColor = 'bg-white/[0.02]';
                    if (isActive) {
                      if (i > 50) barColor = 'bg-blue-300 shadow-[0_0_10px_rgba(147,197,253,0.6)]';
                      else if (i > 40) barColor = 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]';
                      else barColor = 'bg-blue-800 shadow-[0_0_10px_rgba(30,58,138,0.4)]';
                    }

                    return (
                      <motion.div
                        key={i}
                        animate={{ opacity: isActive ? 1 : 0.1, scaleX: isActive ? 1.2 : 1 }}
                        className={`flex-1 rounded-[1.5px] transition-colors duration-200 ${barColor}`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-8 md:p-10 bg-white/[0.01] border-t border-white/5 flex flex-col gap-4">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLaunch}
            disabled={!isLive}
            className={`w-full py-5 rounded-[24px] flex items-center justify-center gap-3 font-black text-xs tracking-[0.2em] uppercase transition-all duration-500 relative overflow-hidden group ${
              isLive 
              ? 'bg-blue-600 text-white shadow-[0_20px_40px_rgba(37,99,235,0.25)] hover:bg-blue-500' 
              : 'bg-white/5 text-white/5 cursor-not-allowed'
            }`}
          >
            <Radio className={`w-4 h-4 transition-transform group-hover:rotate-12 ${isLive ? 'animate-pulse' : ''}`} />
            <span>Engage Transmission</span>
            <ExternalLink className="w-3 h-3 opacity-30" />
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={copyToClipboard}
              className="bg-white/[0.02] hover:bg-white/[0.04] text-blue-100/40 py-4 rounded-[20px] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-white/5 transition-all active:scale-95"
            >
              {copied ? <Check className="w-3 h-3 text-blue-400" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Patch Copied' : 'Invite Link'}
            </button>
            <button
              onClick={() => setShowShareMenu(!showShareMenu)}
              className="bg-white/[0.02] hover:bg-white/[0.04] text-blue-100/40 py-4 rounded-[20px] flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest border border-white/5 transition-all active:scale-95"
            >
              <Share2 className="w-3 h-3" />
              Social Patch
            </button>
          </div>
        </div>

        {/* Share Modal */}
        <AnimatePresence>
          {showShareMenu && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowShareMenu(false)}
                className="absolute inset-0 bg-black/90 backdrop-blur-md z-[60]"
              />
              <motion.div
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                className="absolute bottom-0 left-0 right-0 bg-[#0C1016] border-t border-blue-500/20 rounded-t-[40px] p-10 pb-16 z-[70] shadow-[0_-30px_60px_rgba(0,0,0,0.8)]"
              >
                <div className="w-16 h-1.5 bg-blue-500/20 rounded-full mx-auto mb-10" />
                <h3 className="text-center font-black text-xs uppercase tracking-[0.3em] text-blue-400/40 mb-10">Broadcast Matrix</h3>
                <div className="flex justify-between items-center max-w-sm mx-auto">
                  <button onClick={() => { shareVia('whatsapp'); setShowShareMenu(false); }} className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-blue-500/5 rounded-[28px] flex items-center justify-center border border-blue-500/10 hover:bg-blue-500/10 transition-all active:scale-90">
                      <MessageCircle className="w-8 h-8 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-mono text-blue-400/30 uppercase tracking-widest">WhatsApp</span>
                  </button>
                  <button onClick={() => { shareVia('telegram'); setShowShareMenu(false); }} className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-blue-500/5 rounded-[28px] flex items-center justify-center border border-blue-500/10 hover:bg-blue-500/10 transition-all active:scale-90">
                      <Send className="w-8 h-8 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-mono text-blue-400/30 uppercase tracking-widest">Telegram</span>
                  </button>
                  <button onClick={() => { shareVia('email'); setShowShareMenu(false); }} className="flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-blue-500/5 rounded-[28px] flex items-center justify-center border border-blue-500/10 hover:bg-blue-500/10 transition-all active:scale-90">
                      <Mail className="w-8 h-8 text-blue-500" />
                    </div>
                    <span className="text-[10px] font-mono text-blue-400/30 uppercase tracking-widest">Email</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Status Alerts */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="absolute top-6 left-6 right-6 bg-blue-900/40 backdrop-blur-3xl p-5 rounded-[20px] flex items-start gap-4 z-[100] border border-blue-400/30 shadow-2xl"
            >
              <Shield className="w-5 h-5 text-blue-400 mt-1" />
              <div className="flex-1 space-y-1">
                <p className="text-[11px] font-bold uppercase tracking-tight text-blue-200">Hardware Interlink Alert</p>
                <p className="text-[10px] text-blue-100/60 leading-tight">{error}</p>
              </div>
              <button onClick={() => setError(null)} className="text-[8px] font-black underline text-blue-400 uppercase">Clear</button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Aesthetic Background Grid */}
      <div className="fixed inset-0 pointer-events-none -z-10 bg-[#050608]">
        <div className="absolute top-0 left-0 w-full h-full opacity-10" style={{ backgroundImage: `linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)`, backgroundSize: '100px 100px' }} />
        <div className="absolute bottom-0 left-0 w-full h-[30vh] bg-gradient-to-t from-blue-900/10 to-transparent" />
      </div>
    </div>
  );
}


