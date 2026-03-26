import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  Palette, 
  Box, 
  Zap, 
  Image as ImageIcon, 
  Home, 
  Eraser, 
  Sparkles, 
  Plug, 
  ChevronRight, 
  ChevronLeft,
  Check,
  Layout,
  Layers,
  Settings,
  ArrowLeft,
  Wand2,
  Loader2
} from 'lucide-react';
import { AppState, GenerationSettings, GeneratedImage, AspectRatio, ImageSize, AISuggestions, VisualStyle, ColorChangeEntry, CameraSettings, PackagingFaces, PropConfig } from './types';
import { 
  CAMERA_APERTURES, 
  CAMERA_ISO, 
  TONE_STYLES 
} from './constants';
import { 
  generateProductImage, 
  editProductImage,
  getAiSuggestions, 
  analyzeConceptAndCamera, 
  analyzeTechConceptAndCamera,
  suggestPropsForConcept,
  suggestTechVisuals,
  suggestTechConcepts,
  analyzeStagingScene,
  analyzeStudioConcept
} from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.READY);
  const [loadingMessage, setLoadingMessage] = useState<string>("");
  
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [whiteBgWebStep, setWhiteBgWebStep] = useState<number>(1); 

  const [suggestions, setSuggestions] = useState<AISuggestions>({
    concepts: [],
    locations: [],
    props: []
  });

  const [settings, setSettings] = useState<GenerationSettings>({
    productName: '',
    productImages: [],
    referenceImage: null,
    visualStyle: 'WHITE_BG_WEBSITE',
    techDescription: '',
    colorChanges: [],
    dimensions: { length: '', width: '', height: '' },
    packagingMaterial: 'COLOR_BOX',
    packagingDesignType: 'FLAT_DESIGN',
    packagingOutputStyle: 'WHITE_BG_ROTATED',
    packagingFaces: {},
    techEffectType: 'REMOVE_SIGNATURE',
    techTitle: '',
    selectedTechConcept: '',
    productMaterial: 'MATTE',
    emptySpacePosition: [],
    sockets: [],
    trackSocketMode: 'CREATIVE',
    concept: '',
    location: '',
    camera: { focalLength: 50, aperture: 'f/2.8', iso: '100', isMacro: false, angle: 0 },
    props: [],
    tone: TONE_STYLES[0],
    aspectRatio: '1:1',
    imageSize: '2K',
    aiModel: 'gemini-3.1-flash-image-preview',
    numImages: 1 
  });
  
  const [customConcept, setCustomConcept] = useState('');
  const [customProp, setCustomProp] = useState('');
  const [currentColorPart, setCurrentColorPart] = useState('');
  const [currentPantoneCode, setCurrentPantoneCode] = useState('');
  const [currentColorDescription, setCurrentColorDescription] = useState('');
  const [currentSampleImage, setCurrentSampleImage] = useState<string | null>(null); 
  
  const [gallery, setGallery] = useState<GeneratedImage[]>([]);
  const [activeImage, setActiveImage] = useState<GeneratedImage | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [isEditingImage, setIsEditingImage] = useState(false);
  const [editModel, setEditModel] = useState('gemini-3.1-flash-image-preview');
  const [editQuality, setEditQuality] = useState<ImageSize>('2K');
  const [hasApiKey, setHasApiKey] = useState(true);
  const [imageUrlInput, setImageUrlInput] = useState('');

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(hasKey);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  const productFilesRef = useRef<HTMLInputElement>(null);
  const refFileRef = useRef<HTMLInputElement>(null);
  const colorSampleRef = useRef<HTMLInputElement>(null);
  const packagingFileRef = useRef<HTMLInputElement>(null); 
  const trackFileRef = useRef<HTMLInputElement>(null);
  const socketFileRef = useRef<HTMLInputElement>(null);
  const pendingPackagingFace = useRef<keyof PackagingFaces | "flat">("flat");

  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width; let height = img.height;
          const maxDim = 2560; 
          if (width > maxDim || height > maxDim) {
            const ratio = Math.min(maxDim / width, maxDim / height);
            width = Math.round(width * ratio); height = Math.round(height * ratio);
          }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.onerror = () => reject(new Error("Lỗi đọc ảnh"));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error("Lỗi file"));
      reader.readAsDataURL(file);
    });
  };

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'reference' | 'color_sample' | 'packaging' | 'track' | 'socket') => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      if (type === 'packaging') {
          const base64 = await resizeImage(files[0]);
          const face = pendingPackagingFace.current;
          setSettings(prev => ({ ...prev, packagingFaces: { ...prev.packagingFaces, [face]: base64 } }));
      } else if (type === 'color_sample') {
        const base64 = await resizeImage(files[0]);
        setCurrentSampleImage(base64); 
      } else if (type === 'reference') {
        const base64 = await resizeImage(files[0]);
        setSettings(prev => ({ ...prev, referenceImage: base64 }));
      } else if (type === 'product') {
        const newImages = await Promise.all(Array.from(files).map((file) => resizeImage(file as File)));
        setSettings(prev => ({ ...prev, productImages: [...prev.productImages, ...newImages].slice(0, 5) }));
      } else if (type === 'track') {
        const base64 = await resizeImage(files[0]);
        setSettings(prev => ({ ...prev, trackImage: base64 }));
      } else if (type === 'socket') {
        const base64 = await resizeImage(files[0]);
        setSettings(prev => ({ 
          ...prev, 
          sockets: [...(prev.sockets || []), { id: Date.now().toString(), image: base64, quantity: 1, applianceNote: '' }] 
        }));
      }
    } catch (error) { alert("Lỗi khi tải ảnh."); }
    e.target.value = '';
  };

  const startGeneration = async (overrideSettings?: Partial<GenerationSettings>) => {
    setAppState(AppState.GENERATING);
    setLoadingMessage("Gemini Thinking đang chuẩn bị kiệt tác...");
    try {
      let finalReferenceImage = settings.referenceImage;
      
      if (!finalReferenceImage && imageUrlInput) {
        setLoadingMessage("Đang tải ảnh từ URL...");
        try {
          let blob: Blob | null = null;
          const proxies = [
            imageUrlInput, // Try direct first
            `https://api.allorigins.win/raw?url=${encodeURIComponent(imageUrlInput)}`,
            `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(imageUrlInput)}`,
            `https://corsproxy.io/?${encodeURIComponent(imageUrlInput)}`
          ];
          
          let lastError;
          for (const url of proxies) {
            try {
              const response = await fetch(url);
              if (response.ok) {
                blob = await response.blob();
                break;
              }
            } catch (e) {
              lastError = e;
            }
          }

          if (!blob) throw lastError || new Error("Failed to load image from URL");

          finalReferenceImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob!);
          });
          setSettings(prev => ({ ...prev, referenceImage: finalReferenceImage }));
          setImageUrlInput('');
        } catch (error) {
          console.error("Lỗi khi tải ảnh từ URL:", error);
          alert("Không thể tải ảnh từ URL. Vui lòng kiểm tra lại đường dẫn hoặc tải ảnh lên trực tiếp.");
          setAppState(AppState.READY);
          return;
        }
        setLoadingMessage("Gemini Thinking đang chuẩn bị kiệt tác...");
      }

      const finalSettings = { ...settings, referenceImage: finalReferenceImage, ...overrideSettings };
      const urls = await Promise.all(Array.from({ length: finalSettings.numImages }, (_, i) => generateProductImage(finalSettings, i + 1)));
      const time = Date.now();
      const newImages: GeneratedImage[] = urls.map((url, i) => ({ id: `${time}-${i}`, url, prompt: finalSettings.concept, timestamp: time, settings: { ...finalSettings }, variant: i + 1 }));
      setGallery(prev => [...newImages, ...prev]);
      setActiveImage(newImages[0]);
    } catch (error: any) {
      console.error(error);
      if (error.message === "AUTH_ERROR" || error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        alert("Vui lòng chọn lại API Key.");
      } else {
        alert("Lỗi tạo ảnh.");
      }
    } finally { setAppState(AppState.READY); }
  };

  const handleEditImage = async () => {
    if (!activeImage || !editPrompt.trim()) return;
    setIsEditingImage(true);
    try {
      const newUrl = await editProductImage(activeImage.url, editPrompt, editModel, editQuality);
      const time = Date.now();
      const newImage: GeneratedImage = {
        id: `${time}-edited`,
        url: newUrl,
        prompt: editPrompt,
        timestamp: time,
        settings: { ...activeImage.settings },
        variant: activeImage.variant + 1
      };
      setGallery(prev => [newImage, ...prev]);
      setActiveImage(newImage);
      setEditPrompt("");
    } catch (error: any) {
      console.error(error);
      if (error.message === "AUTH_ERROR" || error.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        alert("Vui lòng chọn lại API Key.");
      } else {
        alert("Lỗi chỉnh sửa ảnh.");
      }
    } finally {
      setIsEditingImage(false);
    }
  };

  const resetMode = () => {
    setCurrentStep(1); setWhiteBgWebStep(1);
    setSettings(prev => ({
      ...prev, productName: '', productImages: [], referenceImage: null, techDescription: '', concept: '', props: [], colorChanges: [], packagingFaces: {}, techTitle: '', selectedTechConcept: '', productMaterial: 'MATTE', emptySpacePosition: [], trackImage: undefined, sockets: []
    }));
    setSuggestions({ concepts: [], locations: [], props: [] });
    setCurrentSampleImage(null); setCustomConcept(''); setCustomProp('');
  };

  // --- REUSABLE COMPONENTS ---

  const StepIndicator = ({ current, total, labels }: { current: number, total: number, labels: string[] }) => (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between relative">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-white/10 -translate-y-1/2 z-0" />
        <motion.div 
          className="absolute top-1/2 left-0 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 -translate-y-1/2 z-0"
          initial={{ width: 0 }}
          animate={{ width: `${((current - 1) / (total - 1)) * 100}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
        
        {labels.map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === current;
          const isCompleted = stepNum < current;
          
          return (
            <div key={idx} className="relative z-10 flex flex-col items-center">
              <motion.div 
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  isActive ? 'bg-[#051610] border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.4)]' : 
                  isCompleted ? 'bg-cyan-500 border-cyan-500 text-[#051610]' : 
                  'bg-[#051610] border-white/20 text-white/40'
                }`}
                animate={isActive ? { scale: 1.1 } : { scale: 1 }}
              >
                {isCompleted ? <Check size={16} strokeWidth={3} /> : <span className="text-xs font-bold">{stepNum}</span>}
              </motion.div>
              <div className={`absolute top-10 whitespace-nowrap text-[8px] font-bold uppercase tracking-wider transition-colors duration-300 ${
                isActive ? 'text-cyan-400' : 'text-slate-500'
              }`}>
                {label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- RENDER FUNCTIONS ---



  // 7.5 Làm ảnh nền trắng Website
  const renderWhiteBgWebWorkflow = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2">Thông tin cơ bản</label>
          <div className="flex flex-col gap-3">
            <input type="text" placeholder="Tên sản phẩm..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" value={settings.productName} onChange={e => setSettings({...settings, productName: e.target.value})} />
            <input type="text" placeholder="Mã sản phẩm..." className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-cyan-400" value={settings.productCode || ''} onChange={e => setSettings({...settings, productCode: e.target.value})} />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-2">Ảnh sản phẩm gốc (Tải lên hoặc dán URL)</label>
          <div className="flex gap-2 mb-2">
            <input 
              type="text" 
              placeholder="Dán đường dẫn hình ảnh (URL)..." 
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-cyan-400" 
              value={imageUrlInput} 
              onChange={e => {
                setImageUrlInput(e.target.value);
                if (e.target.value) {
                  setSettings(prev => ({ ...prev, referenceImage: null }));
                }
              }} 
            />
          </div>
          <div onClick={() => refFileRef.current?.click()} className="h-48 bg-white/5 border-2 border-dashed border-white/10 rounded-xl flex items-center justify-center cursor-pointer overflow-hidden group relative hover:border-cyan-400 transition-all">
             {(settings.referenceImage || imageUrlInput) ? (
               <>
                 <img src={settings.referenceImage || imageUrlInput} className="h-full w-full object-contain" referrerPolicy="no-referrer" onError={(e) => {
                   // Hide broken image icon if URL is invalid
                   (e.target as HTMLImageElement).style.display = 'none';
                 }} onLoad={(e) => {
                   (e.target as HTMLImageElement).style.display = 'block';
                 }} />
                 <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-xs font-bold">Thay ảnh</div>
               </>
             ) : <span className="text-slate-400 text-xs font-bold uppercase group-hover:text-cyan-400">+ Tải ảnh SP gốc</span>}
          </div>
          <input type="file" hidden ref={refFileRef} accept="image/*" onChange={e => {
            onImageUpload(e, 'reference');
            setImageUrlInput(''); // Clear URL if user uploads a file
          }} />
        </div>

        <div className="flex gap-2 pt-2">
          <button disabled={!settings.referenceImage && !imageUrlInput} onClick={() => startGeneration({ whiteBgWebPromptType: 'A' })} className="flex-1 py-4 bg-cyan-500 text-black font-bold rounded-xl uppercase text-xs shadow-lg hover:brightness-110 transition-all disabled:opacity-50">Bóng đổ mềm</button>
          <button disabled={!settings.referenceImage && !imageUrlInput} onClick={() => startGeneration({ whiteBgWebPromptType: 'B' })} className="flex-1 py-4 bg-blue-500 text-white font-bold rounded-xl uppercase text-xs shadow-lg hover:brightness-110 transition-all disabled:opacity-50">Bóng đổ gắt</button>
          <button disabled={!settings.referenceImage && !imageUrlInput} onClick={() => startGeneration({ whiteBgWebPromptType: 'C' })} className="flex-1 py-4 bg-indigo-500 text-white font-bold rounded-xl uppercase text-xs shadow-lg hover:brightness-110 transition-all disabled:opacity-50">Bộ sản phẩm</button>
        </div>
      </div>
    </div>
  );

  const renderSidebar = () => {
    return (
      <div className="animate-fade-in h-full flex flex-col">
         <div className="flex-1">
           <AnimatePresence mode="wait">
             <motion.div
               key={settings.visualStyle}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -20 }}
               transition={{ duration: 0.3 }}
             >
               {settings.visualStyle === 'WHITE_BG_WEBSITE' && renderWhiteBgWebWorkflow()}
             </motion.div>
           </AnimatePresence>
         </div>
      </div>
    );
  };

  const renderCameraSettings = (onBack: () => void) => (
    <div className="space-y-5">
      <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/10">
         <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase"><span>Góc chụp</span><span className="text-[#caf0f8]">{settings.camera.angle}°</span></div>
            <input type="range" min="-15" max="90" step="5" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" value={settings.camera.angle} onChange={e => setSettings({...settings, camera: {...settings.camera, angle: parseInt(e.target.value)}})} />
         </div>
         <div className="space-y-2">
            <div className="flex justify-between text-[9px] font-bold text-slate-400 uppercase"><span>Tiêu cự</span><span className="text-[#caf0f8]">{settings.camera.focalLength}mm</span></div>
            <input type="range" min="12" max="200" step="1" className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer" value={settings.camera.focalLength} onChange={e => setSettings({...settings, camera: {...settings.camera, focalLength: parseInt(e.target.value)}})} />
         </div>
         <div className="grid grid-cols-2 gap-3">
           <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">Khẩu độ</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none focus:border-[#caf0f8]" value={settings.camera.aperture} onChange={e => setSettings({...settings, camera: {...settings.camera, aperture: e.target.value}})}>
                {CAMERA_APERTURES.map(a => <option key={a} value={a} className="bg-[#051610]">{a}</option>)}
              </select>
           </div>
           <div>
              <label className="block text-[8px] font-bold text-slate-400 uppercase mb-1">ISO</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none focus:border-[#caf0f8]" value={settings.camera.iso} onChange={e => setSettings({...settings, camera: {...settings.camera, iso: e.target.value}})}>
                {CAMERA_ISO.map(i => <option key={i} value={i} className="bg-[#051610]">{i}</option>)}
              </select>
           </div>
         </div>
      </div>
      <div className="grid grid-cols-1 gap-3">
        <div>
           <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Tỷ lệ</label>
           <select className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-[10px] text-white outline-none" value={settings.aspectRatio} onChange={e => setSettings({...settings, aspectRatio: e.target.value as AspectRatio})}>
              <option value="1:1" className="bg-[#051610]">1:1 Vuông</option><option value="16:9" className="bg-[#051610]">16:9 HD</option><option value="9:16" className="bg-[#051610]">9:16</option><option value="4:3" className="bg-[#051610]">4:3</option><option value="3:4" className="bg-[#051610]">3:4</option><option value="1:4" className="bg-[#051610]">1:4</option><option value="4:1" className="bg-[#051610]">4:1</option>
           </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 py-4 border border-white/10 text-white rounded-xl uppercase text-[10px] font-bold">Quay lại</button>
        <button onClick={startGeneration} className="flex-[2] vibrant-button text-white font-bold py-4 rounded-xl uppercase text-[12px] shadow-xl">Tạo ảnh</button>
      </div>
    </div>
  );

  if (!hasApiKey) {
    return (
      <div className="fixed inset-0 z-[150] bg-[#051610] flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full space-y-8 glass-card p-10 rounded-[40px] border border-white/10">
          <div className="w-20 h-20 bg-white/10 rounded-3xl mx-auto flex items-center justify-center"><span className="text-3xl">🔑</span></div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-white tracking-tighter">Ai Image Elmich</h1>
            <h2 className="text-lg font-bold text-[#caf0f8]">Yêu cầu API Key</h2>
            <p className="text-xs text-slate-400 mt-2">
              Để sử dụng mô hình Gemini 3.1 chất lượng cao, vui lòng chọn API Key từ Google Cloud project của bạn.
              <br/><br/>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">Xem hướng dẫn thanh toán</a>
            </p>
          </div>
          <button onClick={handleSelectKey} className="w-full vibrant-button text-white font-bold py-4 rounded-[25px] uppercase text-[12px] shadow-xl">Chọn API Key</button>
        </div>
      </div>
    );
  }

  const getDownloadFileName = (image: GeneratedImage) => {
    if (image.settings.visualStyle === 'WHITE_BG_WEBSITE' && image.settings.productCode) {
      const timePart = parseInt(image.id.split('-')[0] || '0', 10);
      const randomNum = ((timePart + (image.variant || 0)) % 100) + 1;
      return `${image.settings.productCode} ${randomNum}.png`;
    }
    return `elmich-ai-${image.id}.png`;
  };

  const calculateCost = (image: GeneratedImage) => {
    let cost = 0;
    if (image.settings.aiModel === 'gemini-3.1-flash-image-preview') {
      if (image.settings.imageSize === '4K') cost = 0.151;
      else if (image.settings.imageSize === '2K') cost = 0.101;
      else cost = 0.067;
    } else {
      cost = 0.03;
    }
    return cost;
  };

  return (
    <div className="min-h-screen flex flex-col relative animate-fade-in">
      <header className="px-6 py-4 flex justify-between items-center z-50 sticky top-0 bg-[#051610]/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20"><span className="text-white font-bold text-lg">AE</span></div>
          <div><h1 className="text-xl font-bold tracking-tighter text-white">Ai Image Elmich</h1><p className="text-[8px] font-bold text-[#caf0f8] tracking-[0.3em] uppercase">Creative Studio 2026</p></div>
        </div>
      </header>
      <main className="flex-1 flex flex-col lg:flex-row gap-6 p-6 max-w-[1600px] mx-auto w-full relative">
        <aside className="w-full lg:w-[420px] glass-card rounded-[35px] overflow-hidden lg:h-[calc(100vh-120px)] lg:sticky lg:top-24 z-10 bg-gradient-to-b from-white/[0.04] to-transparent"><div className="p-6 h-full overflow-y-auto custom-scrollbar">{renderSidebar()}</div></aside>
        <section className="flex-1 flex flex-col gap-6 relative z-10">
          {/* Subtle gradient background for depth */}
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-teal-500/10 rounded-[40px] pointer-events-none blur-3xl -z-10"></div>
          
          <div className="flex-1 glass-card rounded-[40px] p-8 flex items-center justify-center relative min-h-[400px] bg-gradient-to-br from-white/[0.03] to-transparent">
            {appState === AppState.GENERATING || appState === AppState.ANALYZING ? (
              <div className="text-center z-10 space-y-6 animate-pulse">
                <div className="relative w-32 h-32 mx-auto"><div className="absolute inset-0 border-[4px] border-[#caf0f8] border-t-transparent rounded-full animate-spin" /></div>
                <h3 className="text-xl font-bold text-white uppercase tracking-tighter">{loadingMessage}</h3>
              </div>
            ) : activeImage ? (
              <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in w-full">
                <div className="relative group max-w-full bg-black/20 rounded-[30px] p-2 flex justify-center"><img src={activeImage.url} alt="Masterpiece" className="max-h-[60vh] max-w-full block object-contain rounded-[28px] shadow-2xl" /></div>
                <div className="flex gap-4">
                  <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-[#caf0f8]">Phiên bản 0{activeImage.variant}</div>
                  <div className="px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-emerald-400">Chi phí: ${calculateCost(activeImage).toFixed(3)}</div>
                  <a href={activeImage.url} download={getDownloadFileName(activeImage)} className="vibrant-button px-8 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest text-white">Lưu ảnh ✨</a>
                </div>
                
                {/* Edit AI Image Section */}
                <div className="w-full max-w-2xl mt-2 bg-white/5 border border-white/10 rounded-[24px] p-4 flex flex-col gap-3">
                  <label className="text-[10px] font-bold text-[#caf0f8] uppercase flex items-center gap-2">
                    <Wand2 size={14} /> Chỉnh sửa ảnh bằng AI
                  </label>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Nhập yêu cầu chỉnh sửa (VD: Thêm ánh nắng, đổi màu nền...)" 
                        className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-[#caf0f8] transition-all"
                        value={editPrompt}
                        onChange={e => setEditPrompt(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditImage()}
                        disabled={isEditingImage}
                      />
                      <button 
                        onClick={handleEditImage}
                        disabled={isEditingImage || !editPrompt.trim()}
                        className="px-6 bg-[#caf0f8] text-[#051610] font-bold rounded-xl text-xs disabled:opacity-50 flex items-center justify-center min-w-[120px] transition-all hover:brightness-110"
                      >
                        {isEditingImage ? <Loader2 size={16} className="animate-spin" /> : 'Thực hiện'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="flex gap-4 h-32 items-stretch relative z-10">
            <div className="flex-1 glass-card rounded-[35px] p-4 flex gap-4 overflow-x-auto custom-scrollbar items-center bg-gradient-to-tr from-white/[0.02] to-transparent">
                {gallery.length === 0 ? <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[25px] opacity-20 h-full"><span className="text-[9px] font-bold uppercase tracking-[0.4em]">Bộ sưu tập</span></div> : gallery.map(img => <button key={img.id} onClick={() => setActiveImage(img)} className={`flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border-2 transition-all ${activeImage?.id === img.id ? 'border-[#caf0f8]' : 'border-transparent opacity-40 hover:opacity-100'}`}><img src={img.url} className="w-full h-full object-cover" /></button>)}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default App;