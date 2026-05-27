import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, Calendar, FileText, Settings, BarChart3, 
  LogOut, CheckCircle, Save, Printer, Plus, Lock, UploadCloud, AlertCircle, Sparkles, Download, Cloud, CloudOff
} from 'lucide-react';

// --- FIREBASE IMPORTS (CLOUD SYNC) ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, onSnapshot } from 'firebase/firestore';

// --- INIT FIREBASE ---
let app, auth, db, appId;
try {
  const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : null;
  if (firebaseConfig) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
  }
} catch (e) {
  console.error("Firebase init failed:", e);
}

// --- SAFE LOCAL STORAGE HELPER (ANTI-RESET) ---
const getLocal = (key, defaultVal) => {
  try {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultVal;
  } catch(e) {
    return defaultVal;
  }
};

const setLocal = (key, val) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(val));
  } catch(e) {}
};

// --- GET LOCAL DATE (Mencegah bug perbedaan Zona Waktu) ---
const getLocalDate = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
};

// --- GEMINI API HELPER ---
const callGeminiAPI = async (promptText) => {
  const apiKey = "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: promptText }] }],
    systemInstruction: { parts: [{ text: "Anda adalah Asisten AI Pendidikan (Guru BK) yang analitis, profesional, empatik, dan solutif. Format respons Anda dengan paragraf yang rapi dan mudah dibaca." }] }
  };

  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "Maaf, tidak ada respons dari AI.";
    } catch (error) {
      if (i === delays.length) {
        return "Terjadi kesalahan saat menghubungi server AI. Silakan coba lagi nanti.";
      }
      await new Promise(resolve => setTimeout(resolve, delays[i]));
    }
  }
};

// --- HELPER LOAD SCRIPT (Untuk PDF) ---
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// --- MOCK DATA & CONSTANTS ---
const CLASSES = [
  '7A', '7B', '7C', '7D', '7E', '7F', '7G', '7H', '7I', '7J',
  '8A', '8B', '8C', '8D', '8E', '8F', '8G', '8H', '8I', '8J',
  '9A', '9B', '9C', '9D', '9E', '9F', '9G', '9H', '9I', '9J'
];

const INITIAL_TEACHERS = [
  { id: 1, name: 'Budi Santoso, S.Pd', nip: '198001012005011001' },
  { id: 2, name: 'Siti Aminah, M.Pd', nip: '197502022000032002' },
  { id: 3, name: 'Agus Wijaya, S.Kom', nip: '198505052010011003' }
];

const INITIAL_KEPSEK = [
  { id: 1, name: 'Drs. H. Ahmad Dahlan, M.Pd', nip: '196512121990031005' }
];

const generateStudents = (className) => {
  const names = ['Andi', 'Budi', 'Citra', 'Dewi', 'Eka', 'Fajar', 'Gita', 'Hadi', 'Intan', 'Joko', 'Kartika', 'Lukman', 'Maya', 'Nanda', 'Oki', 'Putri', 'Qori', 'Rizki', 'Sari', 'Tegar'];
  const lastNames = ['Pratama', 'Saputra', 'Wijaya', 'Lestari', 'Sari', 'Nugroho', 'Kusuma', 'Pangestu', 'Ramadhan', 'Hidayat'];
  return Array.from({ length: 35 }, (_, i) => ({
    id: `${className}-${i + 1}`,
    name: `${names[i % names.length]} ${lastNames[(i + className.charCodeAt(0)) % lastNames.length]} ${i + 1}`,
    nis: `10${className.replace(/\D/g, '')}0${i + 1}`,
    jk: i % 2 === 0 ? 'L' : 'P'
  }));
};

const NavBtn = ({ active, onClick, icon, text }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3 py-2 mt-1 rounded-md text-sm font-medium transition whitespace-nowrap ${
      active ? 'bg-blue-900 text-white' : 'text-blue-100 hover:bg-blue-600 hover:text-white'
    }`}
  >
    {icon} {text}
  </button>
);

const ToastNotification = ({ toast }) => {
  if (!toast.message) return null;
  const isError = toast.type === 'error';
  return (
    <div className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl shadow-2xl z-[100] text-white font-bold flex items-center space-x-2 animate-bounce ${isError ? 'bg-red-500' : 'bg-emerald-500'}`}>
      {isError ? <AlertCircle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
      <span>{toast.message}</span>
    </div>
  );
};

// --- MAIN APP COMPONENT ---
export default function App() {
  const [currentPage, setCurrentPage] = useState('login'); 
  const [currentDate, setCurrentDate] = useState(getLocalDate());
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  
  // States Diambil dari Local Storage (Anti-Reset)
  const [studentsConfig, setStudentsConfig] = useState(() => getLocal('studentsConfig', {}));
  const [attendanceData, setAttendanceData] = useState(() => getLocal('attendanceData', {})); 
  const [teachers, setTeachers] = useState(() => getLocal('teachers', INITIAL_TEACHERS));
  const [kepseks, setKepseks] = useState(() => getLocal('kepseks', INITIAL_KEPSEK));
  const [sheetUrl, setSheetUrl] = useState(() => getLocal('sheetUrl', ''));

  // Firebase State
  const [fbUser, setFbUser] = useState(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Global Toast State
  const [toast, setToast] = useState({ message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 4000);
  };

  // 1. Inisialisasi Auth Cloud (Sekali)
  useEffect(() => {
    if (!auth) return;
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFbUser(user);
      setIsCloudConnected(!!user);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data Kehadiran Cloud & Merge dengan Local
  useEffect(() => {
    if (!fbUser || !db) return;
    const attendanceRef = collection(db, 'artifacts', appId, 'public', 'data', 'attendance');
    const unsubscribe = onSnapshot(attendanceRef, (snapshot) => {
      if (snapshot.empty) return; // Mencegah Cloud kosong menghapus data lokal
      const cloudData = {};
      snapshot.forEach(docSnap => {
        cloudData[docSnap.id] = docSnap.data();
      });
      setAttendanceData(prev => {
        const merged = { ...prev };
        Object.keys(cloudData).forEach(dateKey => {
           merged[dateKey] = { ...(merged[dateKey] || {}), ...cloudData[dateKey] };
        });
        setLocal('attendanceData', merged);
        return merged;
      });
    }, (error) => {
      console.error("Attendance Sync Error", error);
    });
    return () => unsubscribe();
  }, [fbUser]);

  // 3. Fetch Data Pengaturan & Master dari Cloud
  useEffect(() => {
    if (!fbUser || !db) return;
    const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'masterConfig');
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.studentsConfig) { setStudentsConfig(data.studentsConfig); setLocal('studentsConfig', data.studentsConfig); }
        if (data.teachers) { setTeachers(data.teachers); setLocal('teachers', data.teachers); }
        if (data.kepseks) { setKepseks(data.kepseks); setLocal('kepseks', data.kepseks); }
        if (data.sheetUrl) { setSheetUrl(data.sheetUrl); setLocal('sheetUrl', data.sheetUrl); }
      }
    });
    return () => unsubscribe();
  }, [fbUser]);

  // Fungsi Master Update & Sinkronisasi
  const updateConfig = (newPartialConfig) => {
    if (newPartialConfig.studentsConfig) { setStudentsConfig(newPartialConfig.studentsConfig); setLocal('studentsConfig', newPartialConfig.studentsConfig); }
    if (newPartialConfig.teachers) { setTeachers(newPartialConfig.teachers); setLocal('teachers', newPartialConfig.teachers); }
    if (newPartialConfig.kepseks) { setKepseks(newPartialConfig.kepseks); setLocal('kepseks', newPartialConfig.kepseks); }
    if (newPartialConfig.sheetUrl !== undefined) { setSheetUrl(newPartialConfig.sheetUrl); setLocal('sheetUrl', newPartialConfig.sheetUrl); }
    
    // Backup ke Cloud Jika Tersedia
    if (fbUser && db) {
      try {
        const configRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'masterConfig');
        setDoc(configRef, newPartialConfig, { merge: true });
      } catch (e) {
        console.error("Failed syncing config to cloud", e);
      }
    }
  };

  // Generate students jika di lokal & cloud blm ada
  useEffect(() => {
    if (selectedClass && !studentsConfig[selectedClass]) {
      const fallbackConfig = { ...studentsConfig, [selectedClass]: generateStudents(selectedClass) };
      updateConfig({ studentsConfig: fallbackConfig });
    }
  }, [selectedClass, studentsConfig]);

  const navigate = (page) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setCurrentPage('login');
    showToast("Berhasil Keluar dari Sistem");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans">
      <ToastNotification toast={toast} />

      {/* Navbar */}
      {currentPage !== 'login' && (
        <nav className="bg-blue-700 text-white shadow-md print:hidden sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0 flex items-center font-bold text-xl tracking-tight">
                  <CheckCircle className="w-6 h-6 mr-2 text-blue-200" />
                  Sistem Absensi
                </div>
                <div className="hidden md:flex space-x-2">
                  <NavBtn active={currentPage === 'dashboard'} onClick={() => navigate('dashboard')} icon={<Users className="w-4 h-4 mr-2"/>} text="Pilih Kelas" />
                  <NavBtn active={currentPage === 'rekap'} onClick={() => navigate('rekap')} icon={<FileText className="w-4 h-4 mr-2"/>} text="Rekap Harian" />
                  <NavBtn active={currentPage === 'print'} onClick={() => navigate('print')} icon={<Printer className="w-4 h-4 mr-2"/>} text="Cetak Laporan" />
                  <NavBtn active={currentPage === 'ranking'} onClick={() => navigate('ranking')} icon={<BarChart3 className="w-4 h-4 mr-2"/>} text="Peringkat" />
                  <NavBtn active={currentPage === 'settings'} onClick={() => navigate('settings')} icon={<Settings className="w-4 h-4 mr-2"/>} text="Manajemen Data" />
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div title={isCloudConnected ? "Terhubung ke Cloud" : "Offline / Lokal"} className={`flex items-center text-xs font-bold px-2 py-1 rounded-full border ${isCloudConnected ? 'border-emerald-400 text-emerald-200' : 'border-slate-400 text-slate-300'}`}>
                   {isCloudConnected ? <Cloud className="w-4 h-4 mr-1"/> : <CloudOff className="w-4 h-4 mr-1"/>}
                   {isCloudConnected ? "Online" : "Penyimpanan Lokal"}
                </div>
                <div className="text-sm hidden lg:block text-blue-100 text-right ml-2 border-l border-blue-500 pl-4">
                  <div>Guru: {currentUser?.teacher?.name}</div>
                  <div className="text-xs">{currentDate}</div>
                </div>
                <button onClick={handleLogout} className="p-2 rounded-md hover:bg-blue-600 transition text-blue-100 hover:text-white" title="Keluar">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
          {/* Mobile Nav */}
          <div className="md:hidden flex overflow-x-auto bg-blue-800 pb-2 px-2 border-t border-blue-600">
             <NavBtn active={currentPage === 'dashboard'} onClick={() => navigate('dashboard')} icon={<Users className="w-4 h-4 mr-1"/>} text="Kelas" />
             <NavBtn active={currentPage === 'rekap'} onClick={() => navigate('rekap')} icon={<FileText className="w-4 h-4 mr-1"/>} text="Rekap" />
             <NavBtn active={currentPage === 'print'} onClick={() => navigate('print')} icon={<Printer className="w-4 h-4 mr-1"/>} text="Cetak" />
             <NavBtn active={currentPage === 'ranking'} onClick={() => navigate('ranking')} icon={<BarChart3 className="w-4 h-4 mr-1"/>} text="Peringkat" />
             <NavBtn active={currentPage === 'settings'} onClick={() => navigate('settings')} icon={<Settings className="w-4 h-4 mr-1"/>} text="Manajemen" />
          </div>
        </nav>
      )}

      {/* Main Content Area */}
      <main className="pb-12">
        {currentPage === 'login' && (
          <LoginPage 
            onLogin={(user, date) => {
              setCurrentUser(user);
              setCurrentDate(date);
              navigate('dashboard');
              showToast(`Selamat bertugas, ${user.teacher.name}`);
            }}
            teachers={teachers} setTeachers={(data) => updateConfig({ teachers: data })}
            kepseks={kepseks} setKepseks={(data) => updateConfig({ kepseks: data })}
            showToast={showToast}
          />
        )}
        {currentPage === 'dashboard' && (
          <DashboardPage 
            classes={CLASSES} 
            onSelectClass={(cls) => {
              setSelectedClass(cls);
              navigate('attendance');
            }} 
            currentDate={currentDate}
            attendanceData={attendanceData}
          />
        )}
        {currentPage === 'attendance' && selectedClass && studentsConfig[selectedClass] && (
          <AttendancePage 
            className={selectedClass} 
            students={studentsConfig[selectedClass]} 
            currentDate={currentDate}
            initialData={attendanceData[currentDate]?.[selectedClass] || {}}
            onSave={async (data) => {
              // 1. Simpan ke Memori Lokal HP (Paling Aman dari Reset)
              const newAttendance = {
                ...attendanceData,
                [currentDate]: { ...(attendanceData[currentDate] || {}), [selectedClass]: data }
              };
              setAttendanceData(newAttendance);
              setLocal('attendanceData', newAttendance);
              
              // 2. Backup ke Cloud Storage Firebase (Jika Tersedia)
              if (fbUser && db) {
                try {
                  const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'attendance', currentDate);
                  await setDoc(docRef, { [selectedClass]: data }, { merge: true });
                } catch (err) {
                  console.error("Gagal backup ke cloud", err);
                }
              }
              
              // 3. Kirim ke Database Google Spreadsheet (GAS) jika URL sudah diatur
              if (sheetUrl) {
                try {
                  const absentIds = Object.keys(data).filter(studentId => data[studentId] !== 'H');
                  let payload = [];

                  if (absentIds.length === 0) {
                    payload = [{
                      tanggal: currentDate, kelas: selectedClass, nama_siswa: 'NIHIL', status: '-',
                      guru_piket: currentUser?.teacher?.name || '', kepsek: currentUser?.kepsek?.name || ''
                    }];
                  } else {
                    payload = absentIds.map(studentId => {
                      const student = studentsConfig[selectedClass].find(s => s.id === studentId);
                      return {
                        tanggal: currentDate, kelas: selectedClass,
                        nama_siswa: student ? student.name : 'Siswa Tidak Diketahui',
                        status: data[studentId], guru_piket: currentUser?.teacher?.name || '',
                        kepsek: currentUser?.kepsek?.name || ''
                      };
                    });
                  }
                  
                  fetch(sheetUrl, {
                    method: 'POST', mode: 'no-cors',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'insertAbsensi', payload: payload })
                  });
                  showToast(`Tersimpan ke HP & Terekap di Spreadsheet!`);
                } catch (error) {
                  showToast(`Tersimpan aman di HP, gagal konek ke Spreadsheet.`, 'error');
                }
              } else {
                showToast(`Data Absensi ${selectedClass} Tersimpan Permanen di HP ini.`);
              }
              navigate('dashboard');
            }}
            onBack={() => navigate('dashboard')}
          />
        )}
        {currentPage === 'settings' && (
          <SettingsPage 
            sheetUrl={sheetUrl} setSheetUrl={(url) => updateConfig({ sheetUrl: url })} 
            showToast={showToast}
            setStudentsConfig={(data) => updateConfig({ studentsConfig: data })}
            setTeachers={(data) => updateConfig({ teachers: data })}
            setKepseks={(data) => updateConfig({ kepseks: data })}
            setAttendanceData={(data) => { setAttendanceData(data); setLocal('attendanceData', data); }}
            updateConfig={updateConfig}
          />
        )}
        {currentPage === 'rekap' && (
          <RekapPage 
            currentDate={currentDate}
            attendanceData={attendanceData}
            classes={CLASSES}
            studentsConfig={studentsConfig}
          />
        )}
        {currentPage === 'print' && (
          <PrintPage 
            currentUser={currentUser} 
            currentDate={currentDate}
            attendanceData={attendanceData}
            classes={CLASSES}
            studentsConfig={studentsConfig}
            showToast={showToast}
          />
        )}
        {currentPage === 'ranking' && (
          <RankingPage 
            attendanceData={attendanceData} 
            studentsConfig={studentsConfig}
            currentDate={currentDate}
          />
        )}
      </main>
    </div>
  );
}

// --- 1. HALAMAN LOGIN & MANAJEMEN ---
function LoginPage({ onLogin, teachers, kepseks, showToast }) {
  const [date, setDate] = useState(getLocalDate());
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedKepsekId, setSelectedKepsekId] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedKepsekId) {
      showToast('Silakan pilih Guru Piket dan Kepala Sekolah.', 'error');
      return;
    }
    const teacher = teachers.find(t => t.id == selectedTeacherId);
    const kepsek = kepseks.find(k => k.id == selectedKepsekId);
    onLogin({ teacher, kepsek }, date);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-indigo-800 p-4 relative">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8 flex flex-col items-center">
            <img 
              src="https://i.imgur.com/NjGOmz5.png" 
              alt="Logo SMP Negeri 1 Tanjung" 
              className="w-24 md:w-28 h-auto object-contain mb-3" 
            />
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight leading-snug">
              Sistem Absensi Digital <br />
              <span className="uppercase">SMP Negeri 1 Tanjung</span>
            </h1>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Pilih Tanggal Absensi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="h-5 w-5 text-slate-400" />
                </div>
                <input 
                  type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                  className="pl-10 w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg transition"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Guru Piket / Bertugas</label>
                <select 
                  value={selectedTeacherId} onChange={(e) => setSelectedTeacherId(e.target.value)} required
                  className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg bg-white"
                >
                  <option value="" disabled>-- Pilih Guru --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name} (NIP: {t.nip})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Kepala Sekolah</label>
                <select 
                  value={selectedKepsekId} onChange={(e) => setSelectedKepsekId(e.target.value)} required
                  className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg bg-white"
                >
                  <option value="" disabled>-- Pilih Kepala Sekolah --</option>
                  {kepseks.map(k => <option key={k.id} value={k.id}>{k.name} (NIP: {k.nip})</option>)}
                </select>
              </div>
            </div>

            <button type="submit" className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white text-xl font-bold rounded-xl shadow-lg transform transition hover:-translate-y-1">
              Masuk ke Dasbor
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- 2. HALAMAN DASBOR / PILIH KELAS ---
function DashboardPage({ classes, onSelectClass, currentDate, attendanceData }) {
  const completedForToday = attendanceData[currentDate] || {};

  const grade7 = classes.filter(c => c.startsWith('7'));
  const grade8 = classes.filter(c => c.startsWith('8'));
  const grade9 = classes.filter(c => c.startsWith('9'));

  const ClassGroup = ({ title, clsArray, color }) => (
    <div className="mb-8">
      <h3 className="text-xl font-bold text-slate-700 mb-4 border-b-2 border-slate-200 pb-2">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {clsArray.map(cls => {
          const isCompleted = !!completedForToday[cls];
          return (
            <button
              key={cls}
              onClick={() => !isCompleted && onSelectClass(cls)}
              disabled={isCompleted}
              className={`
                ${isCompleted
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300 shadow-none'
                  : `${color} text-white shadow-md hover:shadow-xl transform hover:-translate-y-1 active:scale-95`
                }
                text-2xl font-bold py-6 rounded-2xl transition flex flex-col items-center justify-center
              `}
            >
              {cls}
              <span className={`text-xs mt-2 flex items-center ${isCompleted ? 'text-emerald-600 font-bold' : 'font-normal opacity-80'}`}>
                {isCompleted ? <><CheckCircle className="w-4 h-4 mr-1" /> Selesai</> : <><Users className="w-3 h-3 mr-1" /> Input Absen</>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-8 flex flex-col md:flex-row justify-between items-center border border-slate-200">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Pilih Kelas</h2>
          <p className="text-slate-500">Pilih kelas untuk menginput absensi pada tanggal <strong className="text-blue-600">{currentDate}</strong>.</p>
        </div>
      </div>
      <ClassGroup title="Kelas VII" clsArray={grade7} color="bg-gradient-to-br from-emerald-400 to-emerald-600" />
      <ClassGroup title="Kelas VIII" clsArray={grade8} color="bg-gradient-to-br from-amber-400 to-amber-600" />
      <ClassGroup title="Kelas IX" clsArray={grade9} color="bg-gradient-to-br from-indigo-400 to-indigo-600" />
    </div>
  );
}

// --- 3. HALAMAN ABSENSI KELAS ---
function AttendancePage({ className, students, currentDate, initialData, onSave, onBack }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localData, setLocalData] = useState(() => {
    const defaultData = {};
    students.forEach(s => { defaultData[s.id] = initialData[s.id] || 'H'; });
    return defaultData;
  });

  const handleStatusChange = (studentId, status) => {
    setLocalData(prev => ({ ...prev, [studentId]: status }));
  };

  const handleHadirSemua = () => {
    const allPresent = {};
    students.forEach(s => { allPresent[s.id] = 'H'; });
    setLocalData(allPresent);
  };

  const summary = { H: 0, A: 0, S: 0, I: 0 };
  Object.values(localData).forEach(val => { if (summary[val] !== undefined) summary[val]++; });

  const getStatusColor = (status) => {
    switch(status) {
      case 'H': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'A': return 'bg-red-100 text-red-800 border-red-300';
      case 'S': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'I': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-slate-100 border-slate-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6 flex flex-col md:flex-row justify-between items-center sticky top-[64px] z-40">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <div className="w-16 h-16 bg-blue-600 text-white rounded-xl flex items-center justify-center text-3xl font-bold">{className}</div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Input Absensi</h2>
            <p className="text-slate-500">Tanggal: {currentDate} • Total: {students.length} Siswa</p>
          </div>
        </div>
        <div className="flex space-x-2 text-sm font-medium">
          <div className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">Hadir: {summary.H}</div>
          <div className="px-3 py-2 bg-red-50 text-red-700 rounded-lg border border-red-100">Alpha: {summary.A}</div>
          <div className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-100">Sakit: {summary.S}</div>
          <div className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100">Izin: {summary.I}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="divide-y divide-slate-100">
          {students.map((student, index) => (
            <div key={student.id} className={`grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center transition hover:bg-slate-50 ${localData[student.id] !== 'H' ? 'bg-red-50/30' : ''}`}>
              <div className="md:col-span-1 text-center font-medium text-slate-500 hidden md:block">{index + 1}</div>
              <div className="md:col-span-7">
                <div className="font-bold text-slate-800 text-lg md:text-base flex items-center">
                  {student.name}
                  {student.jk && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-bold">{student.jk}</span>}
                </div>
              </div>
              <div className="md:col-span-4 flex justify-between md:justify-center space-x-2 w-full mt-3 md:mt-0">
                {['H', 'A', 'S', 'I'].map(status => {
                  const labels = { H: 'Hadir', A: 'Alpha', S: 'Sakit', I: 'Izin' };
                  const isSelected = localData[student.id] === status;
                  return (
                    <button
                      key={status} onClick={() => handleStatusChange(student.id, status)}
                      className={`flex-1 md:flex-none md:w-16 py-3 md:py-2 rounded-xl border-2 font-bold transition-all text-sm ${isSelected ? `${getStatusColor(status)} shadow-md transform scale-105` : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`}
                    >
                      {labels[status]}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-2xl z-50 md:relative md:bg-transparent md:border-0 md:shadow-none md:p-0">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row gap-4">
          <button onClick={onBack} disabled={isSubmitting} className="px-6 py-4 rounded-xl border-2 border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition hidden md:block">Batal</button>
          <button onClick={handleHadirSemua} disabled={isSubmitting} className="flex-1 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-lg shadow-lg flex items-center justify-center transition"><CheckCircle className="w-6 h-6 mr-2" />Hadir Semua / Nihil</button>
          <button 
            onClick={async () => {
              setIsSubmitting(true);
              await onSave(localData);
              setIsSubmitting(false);
            }} 
            disabled={isSubmitting}
            className={`flex-1 py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center transition ${isSubmitting ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            <Save className="w-6 h-6 mr-2" />
            {isSubmitting ? 'Menyimpan...' : 'Simpan & Lanjut'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 4. HALAMAN PENGATURAN ---
function SettingsPage({ sheetUrl, setSheetUrl, showToast, setStudentsConfig, setTeachers, setKepseks, setAttendanceData, updateConfig }) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const [csvStudentUrl, setCsvStudentUrl] = useState('');
  const [csvGuruUrl, setCsvGuruUrl] = useState('');
  const [csvKepsekUrl, setCsvKepsekUrl] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (passwordInput === 'admin123') {
      setIsUnlocked(true);
      showToast("Akses Admin Diberikan!");
    } else {
      showToast("Password Salah!", "error");
      setPasswordInput('');
    }
  };

  const handleResetAll = () => {
    setAttendanceData({});
    updateConfig({ studentsConfig: {}, teachers: INITIAL_TEACHERS, kepseks: INITIAL_KEPSEK, sheetUrl: '' });
    setShowResetConfirm(false);
    showToast("Master Data Berhasil Direset Total!");
  };

  const parseCSV = (str) => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      if (char === '"' && str[i + 1] === '"') {
        currentCell += '"';
        i++; 
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell.trim());
        currentCell = '';
      } else if (char === '\n' && !inQuotes) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
    if (currentCell || currentRow.length > 0) {
       currentRow.push(currentCell.trim());
       rows.push(currentRow);
    }
    return rows.filter(row => row.some(cell => cell !== ''));
  };

  const handleSaveGAS = () => {
    if(!sheetUrl) { showToast("Masukkan URL Web App terlebih dahulu!", "error"); return; }
    showToast("URL Web App Berhasil Disimpan!");
    updateConfig({ sheetUrl });
  };

  const handleTarikDataSiswa = async () => {
    if(!csvStudentUrl) { showToast("Masukkan URL CSV Data Siswa!", "error"); return; }
    try {
      showToast("Mengunduh data Siswa dari Spreadsheet...");
      const response = await fetch(csvStudentUrl);
      if (!response.ok) throw new Error("Gagal mengambil data");
      const text = await response.text();
      const rows = parseCSV(text);

      if (rows.length <= 1) {
         showToast("Data kosong atau format salah!", "error"); return;
      }

      const newConfig = {};
      for (let i = 1; i < rows.length; i++) {
        const [nama, kelas, jk] = rows[i];
        if (nama && kelas) {
          const formattedClass = kelas.toUpperCase().trim();
          if (!newConfig[formattedClass]) newConfig[formattedClass] = [];
          newConfig[formattedClass].push({
            id: `${formattedClass}-${newConfig[formattedClass].length + 1}`,
            name: nama,
            nis: `NIS${Math.floor(1000 + Math.random() * 9000)}`,
            jk: jk ? jk.toUpperCase().trim() : 'L'
          });
        }
      }
      
      updateConfig({ studentsConfig: newConfig });
      showToast(`Berhasil mengimpor data untuk ${Object.keys(newConfig).length} kelas!`);
      setCsvStudentUrl('');
    } catch (error) {
      showToast("Gagal mengambil data. Pastikan link dibagikan Publik.", "error");
    }
  };

  const handleTarikDataGuru = async () => {
    if(!csvGuruUrl) { showToast("Masukkan URL CSV Data Guru!", "error"); return; }
    try {
      showToast("Mengunduh data Guru dari Spreadsheet...");
      const response = await fetch(csvGuruUrl);
      if (!response.ok) throw new Error("Gagal mengambil data");
      const text = await response.text();
      const rows = parseCSV(text);

      if (rows.length <= 1) {
         showToast("Data kosong atau format salah!", "error"); return;
      }

      const newTeachers = [];
      for (let i = 1; i < rows.length; i++) {
        const [nama, nip] = rows[i];
        if (nama) {
          newTeachers.push({ id: Date.now() + i, name: nama, nip: nip || '-' });
        }
      }
      
      updateConfig({ teachers: newTeachers });
      showToast(`Berhasil mengimpor ${newTeachers.length} data Guru!`);
      setCsvGuruUrl('');
    } catch (error) {
      showToast("Gagal mengambil data. Pastikan link dibagikan Publik.", "error");
    }
  };

  const handleTarikDataKepsek = async () => {
    if(!csvKepsekUrl) { showToast("Masukkan URL CSV Data Kepsek!", "error"); return; }
    try {
      showToast("Mengunduh data Kepsek dari Spreadsheet...");
      const response = await fetch(csvKepsekUrl);
      if (!response.ok) throw new Error("Gagal mengambil data");
      const text = await response.text();
      const rows = parseCSV(text);

      if (rows.length <= 1) {
         showToast("Data kosong atau format salah!", "error"); return;
      }

      const newKepsek = [];
      for (let i = 1; i < rows.length; i++) {
        const [nama, nip] = rows[i];
        if (nama) {
          newKepsek.push({ id: Date.now() + i, name: nama, nip: nip || '-' });
        }
      }
      
      updateConfig({ kepseks: newKepsek });
      showToast(`Berhasil mengimpor ${newKepsek.length} data Kepala Sekolah!`);
      setCsvKepsekUrl('');
    } catch (error) {
      showToast("Gagal mengambil data. Pastikan link dibagikan Publik.", "error");
    }
  };

  if (!isUnlocked) {
    return (
      <div className="max-w-md mx-auto mt-20 px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Akses Terbatas</h2>
            <p className="text-slate-500 mt-2">Masukkan password admin untuk mengakses konfigurasi sistem.</p>
          </div>
          <form onSubmit={handleUnlock}>
            <input 
              type="password" 
              value={passwordInput} 
              onChange={(e) => setPasswordInput(e.target.value)} 
              placeholder="Password..."
              className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none mb-4 text-center text-lg tracking-widest"
              autoFocus
            />
            <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition">
              Buka Panel Manajemen
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8 animate-in fade-in zoom-in duration-300">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            <Settings className="w-7 h-7 text-blue-600 mr-3" /> Manajemen Data & Integrasi
          </h2>
          <p className="text-slate-500 mt-2">Kelola penarikan master data siswa, guru, kepala sekolah. Perubahan akan <strong>tersimpan permanen</strong> di HP ini (dan disinkronisasi ke Cloud jika tersedia).</p>
        </div>
        <button onClick={() => setIsUnlocked(false)} className="hidden md:flex text-sm text-slate-500 hover:text-slate-700 font-bold items-center px-4 py-2 border rounded-lg">
          <Lock className="w-4 h-4 mr-2"/> Kunci Panel
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center mb-4">
            <Users className="w-6 h-6 text-emerald-600 mr-3" />
            <h3 className="text-lg font-bold text-slate-800">Data Siswa</h3>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-800 h-20">
            <p className="font-bold mb-1">Format Sheet: DATA_SISWA</p>
            <p>Kolom A (Nama Lengkap), Kolom B (Kelas: cth 7A), Kolom C (L/P)</p>
          </div>
          <div className="mt-auto space-y-3">
            <input 
              type="text" value={csvStudentUrl} onChange={(e) => setCsvStudentUrl(e.target.value)}
              placeholder="Paste URL Publikasi CSV (Data Siswa)..."
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
            />
            <button onClick={handleTarikDataSiswa} className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-sm transition">
              Tarik Data Siswa
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-blue-600 mr-3" />
            <h3 className="text-lg font-bold text-slate-800">Data Guru</h3>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-xs text-blue-800 h-20">
            <p className="font-bold mb-1">Format Sheet: DATA_GURU</p>
            <p>Kolom A (Nama Guru), Kolom B (NIP)</p>
          </div>
          <div className="mt-auto space-y-3">
            <input 
              type="text" value={csvGuruUrl} onChange={(e) => setCsvGuruUrl(e.target.value)}
              placeholder="Paste URL Publikasi CSV (Data Guru)..."
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            />
            <button onClick={handleTarikDataGuru} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-sm transition">
              Tarik Data Guru
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center mb-4">
            <FileText className="w-6 h-6 text-amber-600 mr-3" />
            <h3 className="text-lg font-bold text-slate-800">Data Kepala Sekolah</h3>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800 h-20">
            <p className="font-bold mb-1">Format Sheet: DATA_KEPALA SEKOLAH</p>
            <p>Kolom A (Nama Kepala Sekolah), Kolom B (NIP)</p>
          </div>
          <div className="mt-auto space-y-3">
            <input 
              type="text" value={csvKepsekUrl} onChange={(e) => setCsvKepsekUrl(e.target.value)}
              placeholder="Paste URL Publikasi CSV (Data Kepsek)..."
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm"
            />
            <button onClick={handleTarikDataKepsek} className="w-full py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-sm transition">
              Tarik Data Kepsek
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col">
          <div className="flex items-center mb-4">
            <UploadCloud className="w-6 h-6 text-purple-600 mr-3" />
            <h3 className="text-lg font-bold text-slate-800">Integrasi Database (GAS)</h3>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-4 text-xs text-purple-800 h-20">
            <p className="font-bold mb-1">Google Apps Script Web App URL</p>
            <p>Link untuk sinkronisasi dua arah ke master Spreadsheet Anda.</p>
          </div>
          <div className="mt-auto space-y-3">
            <input 
              type="text" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none text-sm font-mono"
            />
            <button onClick={handleSaveGAS} className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-sm transition">
              Simpan Konfigurasi
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-red-200 p-6 flex flex-col md:col-span-2 mt-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <AlertCircle className="w-6 h-6 text-red-600 mr-3" />
              <h3 className="text-lg font-bold text-red-700">Pusat Reset Master</h3>
            </div>
          </div>
          <p className="text-sm text-slate-600 mb-6 max-w-3xl">Peringatan: Tindakan ini akan <strong>menghapus Master Data Config (Guru, Kepsek, Daftar Siswa) dan Data Absensi</strong> di HP Anda ini.</p>
          
          {showResetConfirm ? (
            <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between animate-in fade-in slide-in-from-top-2">
              <span className="font-bold text-red-700 mb-3 sm:mb-0">Aksi ini tidak dapat diurungkan. Lanjutkan?</span>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 sm:flex-none px-6 py-2 bg-white text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 font-bold transition">Batal</button>
                <button onClick={handleResetAll} className="flex-1 sm:flex-none px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg transition">Ya, Reset Total</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowResetConfirm(true)} className="w-full sm:w-auto px-8 py-3 bg-red-50 text-red-700 font-bold rounded-xl hover:bg-red-100 border border-red-200 transition self-start">
              Reset Semua Data Lokal
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

// --- 5. HALAMAN REKAP HARIAN (DIGITAL SUMMARY) ---
function RekapPage({ currentDate, attendanceData, classes, studentsConfig }) {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  let totalSchoolSiswa = 0;
  let totalSchoolH = 0;
  let totalSchoolS = 0;
  let totalSchoolI = 0;
  let totalSchoolA = 0;
  let kelasSelesai = 0;

  const classSummaries = classes.map(cls => {
    const classData = attendanceData[selectedDate]?.[cls];
    const classStudents = studentsConfig[cls] || generateStudents(cls); 
    const jmlSiswa = classStudents.length;
    totalSchoolSiswa += jmlSiswa;

    if (!classData) return { cls, status: 'Belum Diabsen', H: 0, S: 0, I: 0, A: 0, total: jmlSiswa };
    
    kelasSelesai++;
    let H = 0, S = 0, I = 0, A = 0;
    classStudents.forEach(s => {
        const stat = classData[s.id] || 'H';
        if (stat === 'H') H++;
        else if (stat === 'S') S++;
        else if (stat === 'I') I++;
        else if (stat === 'A') A++;
    });

    totalSchoolH += H;
    totalSchoolS += S;
    totalSchoolI += I;
    totalSchoolA += A;
    
    return { cls, status: 'Selesai', H, S, I, A, total: jmlSiswa };
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-200 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center"><FileText className="w-7 h-7 mr-3 text-blue-600"/> Rekap Digital Harian</h2>
          <p className="text-slate-500 mt-1">Ringkasan kehadiran seluruh kelas.</p>
        </div>
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <label className="font-bold text-slate-700">Pilih Tanggal:</label>
          <div className="relative">
            <Calendar className="absolute inset-y-0 left-0 pl-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-10 w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
        <span className="font-bold text-blue-800 flex items-center">
          Progres Input Guru Hari Ini:
        </span>
        <span className="font-black text-blue-600 text-lg">{kelasSelesai} / {classes.length} Kelas Selesai</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-center">
          <p className="text-emerald-800 font-bold text-sm">Total Hadir</p>
          <p className="text-3xl font-black text-emerald-600 mt-1">{totalSchoolH}</p>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-center">
          <p className="text-amber-800 font-bold text-sm">Total Sakit</p>
          <p className="text-3xl font-black text-amber-600 mt-1">{totalSchoolS}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-center">
          <p className="text-blue-800 font-bold text-sm">Total Izin</p>
          <p className="text-3xl font-black text-blue-600 mt-1">{totalSchoolI}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 shadow-sm hover:shadow transition flex flex-col justify-center">
          <p className="text-red-800 font-bold text-sm">Total Alpha</p>
          <p className="text-3xl font-black text-red-600 mt-1">{totalSchoolA}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                <th className="p-4 font-bold text-center">Kelas</th>
                <th className="p-4 font-bold text-center">Hadir</th>
                <th className="p-4 font-bold text-center">Sakit</th>
                <th className="p-4 font-bold text-center">Izin</th>
                <th className="p-4 font-bold text-center">Alpha</th>
                <th className="p-4 font-bold text-center">Total Siswa</th>
                <th className="p-4 font-bold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {classSummaries.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition">
                  <td className="p-4 text-center font-black text-slate-800">{row.cls}</td>
                  <td className="p-4 text-center text-emerald-600 font-bold">{row.status === 'Selesai' ? row.H : '-'}</td>
                  <td className="p-4 text-center text-amber-500 font-bold">{row.status === 'Selesai' ? row.S : '-'}</td>
                  <td className="p-4 text-center text-blue-500 font-bold">{row.status === 'Selesai' ? row.I : '-'}</td>
                  <td className="p-4 text-center text-red-500 font-bold">{row.status === 'Selesai' ? row.A : '-'}</td>
                  <td className="p-4 text-center text-slate-600 font-medium">{row.total}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${row.status === 'Selesai' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-50 text-red-500'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- 7. MENU KHUSUS CETAK LAPORAN (F4) ---
function PrintPage({ currentUser, currentDate, attendanceData, classes, studentsConfig, showToast }) {
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [isDownloading, setIsDownloading] = useState(false);
  const printRef = useRef(null); 

  const formatTanggal = (dateStr) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    const bulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${parseInt(d)} ${bulan[parseInt(m)-1]} ${y}`;
  };

  let tableRows = [];
  let no = 1;
  let totalS = 0, totalI = 0, totalA = 0, totalHadir = 0, totalSiswaSeluruh = 0;

  classes.forEach(cls => {
    const classData = attendanceData[selectedDate]?.[cls];
    const classStudents = studentsConfig[cls] || generateStudents(cls); 
    const jmlSiswa = classStudents.length;

    if (!classData) {
      tableRows.push({ no: no++, nama: '-', kelas: cls, S: '', I: '', A: '', ket: '', jmlHadir: '', jmlSiswa: '', status: 'Belum Diabsen' });
    } else {
      const absents = Object.keys(classData).filter(id => classData[id] !== 'H');
      const jmlHadir = jmlSiswa - absents.length;
      totalHadir += jmlHadir;
      totalSiswaSeluruh += jmlSiswa;

      if (absents.length === 0) {
        tableRows.push({ no: no++, nama: 'NIHIL', kelas: cls, S: '', I: '', A: '', ket: '', jmlHadir, jmlSiswa, status: 'Selesai' });
      } else {
        absents.forEach((id, index) => {
          const student = classStudents.find(s => s.id === id);
          const stat = classData[id];
          if (stat === 'S') totalS++;
          if (stat === 'I') totalI++;
          if (stat === 'A') totalA++;
          
          let ketText = '';
          if (stat === 'S') ketText = 'SAKIT';
          if (stat === 'I') ketText = 'IZIN';
          if (stat === 'A') ketText = 'ALPHA';

          tableRows.push({
            no: no++,
            nama: student?.name || 'Siswa',
            kelas: cls,
            S: stat === 'S' ? '✓' : '',
            I: stat === 'I' ? '✓' : '',
            A: stat === 'A' ? '✓' : '',
            ket: ketText,
            jmlHadir: index === 0 ? jmlHadir : '', 
            jmlSiswa: index === 0 ? jmlSiswa : '', 
            status: 'Selesai'
          });
        });
      }
    }
  });

  const handleBrowserPrint = () => {
    setTimeout(() => { window.print(); }, 100);
  };

  const handleDownloadPDF = async () => {
    const element = printRef.current;
    
    if (!element || !(element instanceof HTMLElement)) {
      if (showToast) showToast('Data belum siap untuk dicetak.', 'error');
      return;
    }

    setIsDownloading(true);
    
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');
      
      const opt = {
        margin:       0.39, 
        filename:     `Rekap_Absensi_${selectedDate}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, logging: false, windowWidth: 1024 }, // Paksa render mode Desktop
        jsPDF:        { unit: 'in', format: [8.5, 13], orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', '.break-inside-avoid'] } 
      };
      
      window.html2pdf().set(opt).from(element).save()
        .then(() => setIsDownloading(false))
        .catch(err => {
          console.error(err);
          setIsDownloading(false);
          if(showToast) showToast('Gagal memproses. Gunakan tombol Cetak (Browser).', 'error');
        });
    } catch (err) {
      console.error(err);
      setIsDownloading(false);
      if(showToast) showToast('Gagal memuat sistem PDF. Periksa koneksi internet Anda.', 'error');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 print:p-0 print:max-w-none">
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-slate-200 print:hidden gap-4">
        <div className="flex items-center space-x-4 w-full md:w-auto">
          <label className="font-bold text-slate-700">Lihat Tanggal:</label>
          <div className="relative">
            <Calendar className="absolute inset-y-0 left-0 pl-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-10 w-full p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        
        <div className="flex space-x-3 w-full md:w-auto">
          <button onClick={handleBrowserPrint} className="flex-1 md:flex-none px-5 py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-lg shadow transition flex items-center justify-center">
            <Printer className="inline w-5 h-5 mr-2"/> Cetak (Browser)
          </button>
          <button onClick={handleDownloadPDF} disabled={isDownloading} className={`flex-1 md:flex-none px-5 py-2.5 text-white font-bold rounded-lg shadow transition flex items-center justify-center ${isDownloading ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <Download className="inline w-5 h-5 mr-2"/>
            {isDownloading ? 'Memproses PDF...' : 'Download PDF (F4)'}
          </button>
        </div>
      </div>

      {/* CONTAINER SCROLL HORIZONTAL UNTUK HP (MENCEGAH LAYOUT HANCUR SAAT DI PDF) */}
      <div className="w-full overflow-x-auto pb-4 print:overflow-visible">
        {/* UKURAN KERTAS DIKUNCI MATI (210mm) AGAR TATA LETAK TIDAK TERGENCET LAYAR HP */}
        <div ref={printRef} className="bg-white p-8 mx-auto text-black border border-slate-200 shadow-xl print:border-none print:shadow-none flex-shrink-0" style={{ width: '210mm', minWidth: '210mm', minHeight: '330mm' }}>
        
        {/* KOP SURAT FORMAL */}
        <div className="flex items-center justify-between pb-3 break-inside-avoid" style={{ fontFamily: '"Times New Roman", Times, serif' }}>
          <div className="w-[70px] flex-shrink-0 flex items-center justify-center">
            <img src="https://i.imgur.com/Lla1xmI.png" alt="Logo Kabupaten Brebes" className="w-full h-auto object-contain" />
          </div>
          <div className="text-center flex-1 px-4 tracking-wide">
            <p className="text-[14px] font-bold uppercase leading-snug">Pemerintah Kabupaten Brebes</p>
            <p className="text-[14px] font-bold uppercase leading-snug">Dinas Pendidikan Pemuda dan Olahraga</p>
            <p className="text-[14px] font-bold uppercase leading-snug">UPT Satuan Pendidikan</p>
            <h1 className="text-[22px] font-black uppercase mt-1 leading-tight tracking-wider">SMP NEGERI 1 TANJUNG</h1>
            <h2 className="text-[16px] font-bold uppercase leading-tight tracking-widest mt-1">KECAMATAN TANJUNG</h2>
            <p className="text-[11px] mt-2 tracking-normal">Jl. Cemara No. 7 ☎ (0283) 877490 / fax (0283) 877122 Tanjung - Brebes</p>
            <p className="text-[11px] tracking-normal">Website: <span className="underline">www.smpntanjung1.ac.id</span> | Email: <span className="underline">smpntanjung1@Gmail.com</span></p>
          </div>
          <div className="w-[85px] flex-shrink-0 flex items-center justify-center">
            <img src="https://i.imgur.com/NjGOmz5.png" alt="Logo SMP N 1 Tanjung" className="w-full h-auto object-contain" />
          </div>
        </div>
        
        <div className="border-b-[3px] border-black mt-2"></div>
        <div className="border-b-[1px] border-black mt-[2px] mb-6"></div>

        <div className="text-center mb-6">
          <h3 className="text-[15px] font-bold tracking-widest underline decoration-2 underline-offset-4 mb-1">REKAPITULASI KEHADIRAN SISWA</h3>
          <p className="text-sm font-medium">Tanggal: {formatTanggal(selectedDate)}</p>
        </div>

        {/* Tabel Klasik Hitam-Putih */}
        <table className="w-full border-collapse border border-black text-[11px] mb-8 font-medium text-black">
          <thead>
            <tr className="text-center break-inside-avoid">
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>NO</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>NAMA</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>KELAS</th>
              <th className="border border-black py-1 px-2 font-bold" colSpan={3}>KETERANGAN</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>KET</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>JUMLAH<br/>HADIR</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>JUMLAH<br/>SISWA</th>
              <th className="border border-black py-2 px-2 font-bold" rowSpan={2}>STATUS</th>
            </tr>
            <tr className="text-center break-inside-avoid">
              <th className="border border-black py-1 w-7 font-bold">S</th>
              <th className="border border-black py-1 w-7 font-bold">I</th>
              <th className="border border-black py-1 w-7 font-bold">A</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, idx) => (
              <tr key={idx} className="break-inside-avoid">
                <td className="border border-black py-1.5 px-2 text-center">{row.no}</td>
                <td className="border border-black py-1.5 px-3 font-semibold">{row.nama}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.kelas}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.S}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.I}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.A}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.ket || ''}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.jmlHadir}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.jmlSiswa}</td>
                <td className="border border-black py-1.5 px-2 text-center">{row.status}</td>
              </tr>
            ))}
            {/* Baris Total */}
            <tr className="font-bold break-inside-avoid">
              <td className="border border-black p-2 text-center uppercase tracking-widest" colSpan={3}>TOTAL KESELURUHAN</td>
              <td className="border border-black p-2 text-center">{totalS > 0 ? totalS : 0}</td>
              <td className="border border-black p-2 text-center">{totalI > 0 ? totalI : 0}</td>
              <td className="border border-black p-2 text-center">{totalA > 0 ? totalA : 0}</td>
              <td className="border border-black p-2 text-center"></td>
              <td className="border border-black p-2 text-center">{totalHadir}</td>
              <td className="border border-black p-2 text-center">{totalSiswaSeluruh}</td>
              <td className="border border-black p-2 text-center"></td>
            </tr>
          </tbody>
        </table>

        {/* Tanda Tangan (Sesuai perbaikan rata kiri & sejajar) */}
        <div className="mt-10 text-[13px] text-black font-medium break-inside-avoid px-12">
          <div className="grid grid-cols-2 gap-8">
            <div className="text-left flex flex-col justify-between h-32">
              <div>
                <p className="invisible">Tanjung, {formatTanggal(selectedDate)}</p>
                <p>Guru Piket,</p>
              </div>
              <div>
                <p className="font-bold underline decoration-1 underline-offset-2 mb-1">{currentUser?.teacher?.name || '________________________'}</p>
                <p className="font-bold">NIP. {currentUser?.teacher?.nip || '________________'}</p>
              </div>
            </div>
            
            <div className="text-left flex flex-col justify-between h-32">
              <div>
                <p>Tanjung, {formatTanggal(selectedDate)}</p>
                <p>Kepala Sekolah,</p>
              </div>
              <div>
                <p className="font-bold underline decoration-1 underline-offset-2 mb-1">{currentUser?.kepsek?.name || '________________________'}</p>
                <p className="font-bold">NIP. {currentUser?.kepsek?.nip || '________________'}</p>
              </div>
            </div>
          </div>
        </div>

        </div>
      </div>
    </div>
  );
}

// --- 8. HALAMAN PERINGKAT (REAL-TIME DENGAN AI) ---
function RankingPage({ attendanceData, studentsConfig, currentDate }) {
  const [timeframe, setTimeframe] = useState('hari');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const aggregateData = () => {
    const stats = { A: {}, S: {}, I: {} };
    let totalA = 0, totalS = 0, totalI = 0;
    const targetDate = new Date(currentDate);

    Object.entries(attendanceData).forEach(([dateStr, dateData]) => {
      const recordDate = new Date(dateStr);
      let isIncluded = false;

      if (timeframe === 'hari') isIncluded = dateStr === currentDate;
      else if (timeframe === 'minggu') isIncluded = Math.ceil(Math.abs(targetDate - recordDate) / (1000 * 60 * 60 * 24)) <= 7;
      else if (timeframe === 'bulan') isIncluded = recordDate.getMonth() === targetDate.getMonth() && recordDate.getFullYear() === targetDate.getFullYear();

      if (isIncluded) {
        Object.entries(dateData).forEach(([className, classData]) => {
          Object.entries(classData).forEach(([studentId, status]) => {
            if (status === 'A' || status === 'S' || status === 'I') {
              if (!stats[status][studentId]) {
                const studentInfo = studentsConfig[className]?.find(s => s.id === studentId);
                stats[status][studentId] = { nama: studentInfo ? studentInfo.name : 'Siswa Tidak Diketahui', kelas: className, jumlah: 0 };
              }
              stats[status][studentId].jumlah++;
              if (status === 'A') totalA++;
              if (status === 'S') totalS++;
              if (status === 'I') totalI++;
            }
          });
        });
      }
    });

    const getTopList = (statusObj) => Object.values(statusObj).sort((a, b) => b.jumlah - a.jumlah).slice(0, 10);
    return { alpha: getTopList(stats['A']), sakit: getTopList(stats['S']), izin: getTopList(stats['I']), stats: { alpha: totalA, sakit: totalS, izin: totalI } };
  };

  const currentData = aggregateData();

  const handleGenerateAI = async () => {
    setIsAiLoading(true);
    setAiAnalysis('');
    
    const alphaNames = currentData.alpha.length > 0 ? currentData.alpha.slice(0, 3).map(s => `${s.nama} (${s.kelas})`).join(', ') : 'Nihil';
    const prompt = `Buatkan ringkasan evaluasi kedisiplinan dan rekomendasi tindakan (maksimal 3 paragraf singkat) berdasarkan data absensi sekolah berikut:
    - Periode Analisis: ${timeframe === 'hari' ? 'Hari Ini' : timeframe === 'minggu' ? 'Minggu Ini' : 'Bulan Ini'}
    - Total Kasus Alpha (Tanpa Keterangan): ${currentData.stats.alpha}
    - Total Kasus Sakit: ${currentData.stats.sakit}
    - Total Kasus Izin: ${currentData.stats.izin}
    - Siswa dengan Kasus Alpha Tertinggi: ${alphaNames}.
    Fokuskan wawasan pada langkah preventif, atau berikan apresiasi jika tingkat kehadiran dinilai baik.`;

    const response = await callGeminiAPI(prompt);
    
    setAiAnalysis(response);
    setIsAiLoading(false);
  };

  const RankingCard = ({ title, data, typeColor, iconColor, badgeColor }) => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6 md:mb-0 flex flex-col transition-all hover:shadow-md">
      <div className={`${typeColor} p-4 border-b border-slate-100 flex items-center justify-between`}>
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold ${badgeColor} bg-white bg-opacity-90 shadow-sm uppercase tracking-wider`}>Terbanyak</span>
      </div>
      <div className="flex-1 bg-white">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <CheckCircle className="w-8 h-8 mb-2 opacity-50" />
            <span className="text-sm font-medium">Belum ada data / Nihil</span>
          </div>
        ) : (
          data.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition duration-150">
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold mr-3 text-sm ${idx === 0 ? 'bg-yellow-100 text-yellow-700 shadow-sm' : idx === 1 ? 'bg-slate-200 text-slate-700 shadow-sm' : 'bg-orange-100 text-orange-700 shadow-sm'}`}>
                  #{idx + 1}
                </div>
                <div>
                  <p className="font-bold text-slate-800">{item.nama}</p>
                  <p className="text-xs text-slate-500 font-medium">Kelas: {item.kelas}</p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-2xl font-black ${iconColor}`}>{item.jumlah}</span>
                <span className="text-[10px] text-slate-400 block -mt-1 font-medium uppercase tracking-widest">Kali</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center"><BarChart3 className="w-7 h-7 mr-3 text-blue-600" /> Dasbor Analitik</h2>
          <p className="text-slate-500 mt-1 text-sm md:text-base">Pemantauan peringkat ketidakhadiran siswa untuk bahan evaluasi.</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-xl shadow-inner w-full md:w-auto overflow-x-auto">
          <button onClick={() => setTimeframe('hari')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'hari' ? 'bg-white text-blue-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Hari Ini</button>
          <button onClick={() => setTimeframe('minggu')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'minggu' ? 'bg-white text-blue-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Minggu Ini</button>
          <button onClick={() => setTimeframe('bulan')} className={`flex-1 md:flex-none whitespace-nowrap px-4 py-2.5 rounded-lg text-sm font-bold transition-all ${timeframe === 'bulan' ? 'bg-white text-blue-700 shadow' : 'text-slate-500 hover:text-slate-700'}`}>Bulan Ini</button>
        </div>
      </div>

      {/* --- BAGIAN INTEGRASI AI GEMINI --- */}
      <div className="mb-8 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-2xl p-6 shadow-sm overflow-hidden relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div>
            <h3 className="text-lg font-bold text-indigo-900 flex items-center">
              <Sparkles className="w-5 h-5 mr-2 text-indigo-600" /> Rekomendasi Asisten AI ✨
            </h3>
            <p className="text-sm text-indigo-700 mt-1">Dapatkan analisis otomatis terkait tren kehadiran siswa saat ini.</p>
          </div>
          <button 
            onClick={handleGenerateAI} 
            disabled={isAiLoading} 
            className={`px-5 py-2.5 rounded-xl font-bold text-white shadow-md transition-all flex items-center ${isAiLoading ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {isAiLoading ? 'Sedang Menganalisis...' : 'Analisis Data ✨'}
          </button>
        </div>
        
        {aiAnalysis && (
          <div className="mt-4 p-5 bg-white rounded-xl border border-indigo-100 shadow-inner">
            <div className="text-slate-700 text-sm md:text-base leading-relaxed whitespace-pre-line">
              {aiAnalysis}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow transition">
          <div><p className="text-red-800 font-bold text-sm">Total Alpha</p><p className="text-3xl font-black text-red-600 mt-1">{currentData.stats.alpha}</p></div>
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center"><AlertCircle className="text-red-500 w-6 h-6"/></div>
        </div>
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow transition">
          <div><p className="text-amber-800 font-bold text-sm">Total Sakit</p><p className="text-3xl font-black text-amber-600 mt-1">{currentData.stats.sakit}</p></div>
          <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center"><Plus className="text-amber-500 w-6 h-6"/></div>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 flex items-center justify-between shadow-sm hover:shadow transition">
          <div><p className="text-blue-800 font-bold text-sm">Total Izin</p><p className="text-3xl font-black text-blue-600 mt-1">{currentData.stats.izin}</p></div>
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center"><FileText className="text-blue-500 w-6 h-6"/></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RankingCard title="Sering ALPHA" data={currentData.alpha} typeColor="bg-red-100" iconColor="text-red-600" badgeColor="text-red-700" />
        <RankingCard title="Sering SAKIT" data={currentData.sakit} typeColor="bg-amber-100" iconColor="text-amber-600" badgeColor="text-amber-700" />
        <RankingCard title="Sering IZIN" data={currentData.izin} typeColor="bg-blue-100" iconColor="text-blue-600" badgeColor="text-blue-700" />
      </div>
    </div>
  );
}