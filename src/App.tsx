import React, { useState, useMemo, useEffect } from 'react';
import { Search, Calculator, CalendarDays, Users, Lock, LogOut, Edit2, Trash2, Check, X, Download, Clock, Package, FileSpreadsheet } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';

// --- Tipi di dato ---
type RoomStatus = 'libera' | 'prenotata' | 'occupata' | 'pulizia' | 'manutenzione';

interface Guest {
  id: string;
  name: string;
  room: string;
  checkIn: string;
}

// --- Componenti UI ---
const Logo = () => (
  <div className="relative w-12 h-12 flex items-center justify-center bg-slate-100 rounded-full overflow-hidden border border-slate-200">
    <svg viewBox="0 0 100 100" className="w-10 h-10">
      {/* Corpo e Testa Gatto Nero */}
      <circle cx="50" cy="65" r="30" fill="#1e293b" />
      <circle cx="50" cy="35" r="22" fill="#1e293b" />
      {/* Orecchie */}
      <path d="M32 25 L 22 5 L 45 22 Z" fill="#1e293b" />
      <path d="M68 25 L 78 5 L 55 22 Z" fill="#1e293b" />
      {/* Macchia Bianca (Petto/Muso) */}
      <path d="M40 45 Q 50 55 60 45 Q 65 75 50 85 Q 35 75 40 45 Z" fill="white" />
      {/* Occhi */}
      <circle cx="42" cy="35" r="3" fill="white" />
      <circle cx="58" cy="35" r="3" fill="white" />
      {/* Nasino */}
      <circle cx="50" cy="42" r="2" fill="#f43f5e" />
    </svg>
  </div>
);

export default function App() {
  // ==========================================
  // STATO CONDIVISO E CALENDARIO DINAMICO
  // ==========================================
  const [now, setNow] = useState(new Date());

  // Aggiorna l'orologio ogni secondo
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Il calendario parte da "oggi" (o dal 6 Marzo se preferito fisso, 
  // ma l'utente ha chiesto che rispetti il giorno in cui lo si usa)
  const startDate = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [now.toDateString()]); // Ricalcola solo se cambia il giorno
  
  const calendarDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      return {
        name: date.toLocaleDateString('it-IT', { weekday: 'short' }),
        date: date.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        fullDate: date.toISOString().split('T')[0]
      };
    });
  }, [startDate]);

  const rooms = ['101', '102', '103', '104', '105'];
  
  const [grid, setGrid] = useState<RoomStatus[][]>(
    Array(5).fill(null).map(() => Array(7).fill('libera'))
  );

  const [guests, setGuests] = useState<Guest[]>([]);
  
  // Orologio Formattato
  const currentTime = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const currentDateStr = now.toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  // In Excel: =ADESSO() o =OGGI()
  
  // ==========================================
  // STATO RECEPTIONIST
  // ==========================================
  const [formData, setFormData] = useState({ name: '', room: '101', checkIn: '' });
  const [formErrors, setFormErrors] = useState({ name: '', room: '', checkIn: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [nights, setNights] = useState<number>(1);
  const [extras, setExtras] = useState<number>(0);
  const roomRate = 80;

  // ==========================================
  // STATO ADMIN
  // ==========================================
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [password, setPassword] = useState('');
  
  const [editingGuestId, setEditingGuestId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', room: '101', checkIn: '' });

  // ==========================================
  // FUNZIONI CONDIVISE E RECEPTIONIST
  // ==========================================
  const toggleCellStatus = (roomIndex: number, dayIndex: number) => {
    setGrid(prevGrid => {
      const newGrid = [...prevGrid];
      const currentStatus = newGrid[roomIndex][dayIndex];
      
      let nextStatus: RoomStatus = 'libera';
      if (currentStatus === 'libera') nextStatus = 'prenotata';
      else if (currentStatus === 'prenotata') nextStatus = 'occupata';
      else if (currentStatus === 'occupata') nextStatus = 'pulizia';
      else if (currentStatus === 'pulizia') nextStatus = 'manutenzione';
      else if (currentStatus === 'manutenzione') nextStatus = 'libera';
      
      newGrid[roomIndex][dayIndex] = nextStatus;
      return newGrid;
    });
  };

  const getStatusColor = (status: RoomStatus) => {
    switch(status) {
      case 'libera': return 'bg-emerald-200 text-emerald-800';
      case 'prenotata': return 'bg-blue-200 text-blue-800';
      case 'occupata': return 'bg-rose-200 text-rose-800';
      case 'pulizia': return 'bg-amber-200 text-amber-800';
      case 'manutenzione': return 'bg-slate-300 text-slate-800';
      default: return 'bg-gray-100';
    }
  };

  const handleAddGuest = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In Excel: Convalida Dati (Data Validation)
    const errors = { name: '', room: '', checkIn: '' };
    let isValid = true;

    if (!formData.name.trim()) {
      errors.name = 'Il nome è obbligatorio';
      isValid = false;
    }

    if (!formData.room) {
      errors.room = 'La camera è obbligatoria';
      isValid = false;
    }

    if (!formData.checkIn) {
      errors.checkIn = 'La data è obbligatoria';
      isValid = false;
    } else {
      const date = new Date(formData.checkIn);
      if (isNaN(date.getTime())) {
        errors.checkIn = 'Data non valida';
        isValid = false;
      }
    }

    setFormErrors(errors);

    if (!isValid) return;

    setGuests([...guests, { id: Date.now().toString(), ...formData }]);
    setFormData({ name: '', room: '101', checkIn: '' });
    setFormErrors({ name: '', room: '', checkIn: '' });
  };

  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      const matchesName = guest.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDate = filterDate ? guest.checkIn === filterDate : true;
      return matchesName && matchesDate;
    });
  }, [guests, searchTerm, filterDate]);

  const exportToExcel = async () => {
    // In Excel: File -> Salva con nome -> Cartella di lavoro di Excel (.xlsx)
    // Usiamo ExcelJS per una formattazione avanzata (colori, bordi, font)
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registro Camere');

    // Dati di esempio (come nell'immagine)
    const rows = [
      ["Camera", "Piano", "Tipo", "Stato", "Ospite", "Prezzo €/notte", "Notti", "Ricavo €"],
      ["101", "1", "Singola", "Libera", "", 80, 0, 0],
      ["102", "1", "Doppia", "Occupata", "Rossi Marco", 120, 2, 240],
      ["103", "1", "Doppia", "Check-out", "Bianchi Sara", 120, 1, 120],
      ["104", "1", "Suite", "Pulizia", "", 220, 0, 0],
      ["201", "2", "Singola", "Libera", "", 80, 0, 0],
      ["202", "2", "Doppia", "Occupata", "Verdi Luca", 120, 3, 360],
      ["203", "2", "Suite", "Manutenzione", "", 220, 0, 0],
      ["204", "2", "Doppia", "Libera", "", 120, 0, 0],
      ["301", "3", "Suite", "Occupata", "Ferrari Anna", 220, 5, 1100],
      ["302", "3", "Doppia", "Libera", "", 120, 0, 0],
      ["303", "3", "Singola", "Pulizia", "", 80, 0, 0],
      ["304", "3", "Suite", "Check-out", "Ricci Paolo", 220, 2, 440]
    ];

    // 1. Titolo Principale
    worksheet.mergeCells('A1:H1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = "🐱 Hotel Da Pippino — Registro Camere";
    titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(1).height = 40;

    // 2. Intestazioni Colonne
    const headerRow = worksheet.addRow(rows[0]);
    headerRow.height = 25;
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // 3. Aggiunta Dati e Formattazione
    rows.slice(1).forEach((rowData, index) => {
      const row = worksheet.addRow(rowData);
      row.height = 22;

      // Colore alternato per le righe (Zebra stripes)
      if (index % 2 === 1) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        });
      }

      // Formattazione specifica per le celle
      row.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };

        // Colonna Stato (D)
        if (colNumber === 4) {
          const status = cell.value as string;
          cell.font = { bold: true };
          if (status === 'Libera') {
            cell.font = { color: { argb: 'FF059669' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
          } else if (status === 'Occupata') {
            cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
          } else if (status === 'Check-out') {
            cell.font = { color: { argb: 'FF7C3AED' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } };
          } else if (status === 'Pulizia') {
            cell.font = { color: { argb: 'FFD97706' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
          } else if (status === 'Manutenzione') {
            cell.font = { color: { argb: 'FF475569' }, bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          }
        }

        // Colonne Prezzo e Ricavo (F, H)
        if (colNumber === 6 || colNumber === 8) {
          cell.numFmt = '"€" #,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          if (colNumber === 8) cell.font = { bold: true };
        }
      });
    });

    // 4. Larghezza Colonne
    worksheet.columns = [
      { width: 12 }, // Camera
      { width: 8 },  // Piano
      { width: 15 }, // Tipo
      { width: 18 }, // Stato
      { width: 25 }, // Ospite
      { width: 18 }, // Prezzo
      { width: 10 }, // Notti
      { width: 18 }  // Ricavo
    ];

    // Esportazione
    // --- FOGLIO 2: REGISTRO CLIENTI ---
    const guestSheet = workbook.addWorksheet('Registro Clienti');
    guestSheet.mergeCells('A1:D1');
    const guestTitle = guestSheet.getCell('A1');
    guestTitle.value = "👥 Registro Storico Clienti";
    guestTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    guestTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    guestTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    guestSheet.getRow(1).height = 30;

    const guestHeaders = ["ID Cliente", "Nome Completo", "Camera Assegnata", "Data Check-in"];
    const guestHeaderRow = guestSheet.addRow(guestHeaders);
    guestHeaderRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    guests.forEach((g, index) => {
      const row = guestSheet.addRow([g.id, g.name, g.room, g.checkIn]);
      if (index % 2 === 1) {
        row.eachCell(c => c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } });
      }
      row.eachCell(c => {
        c.border = { top: { style: 'thin', color: { argb: 'FFE2E8F0' } }, left: { style: 'thin', color: { argb: 'FFE2E8F0' } }, bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }, right: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
        c.alignment = { vertical: 'middle', horizontal: 'center' };
      });
    });
    guestSheet.columns = [{ width: 15 }, { width: 30 }, { width: 20 }, { width: 20 }];

    // --- FOGLIO 3: CALCOLO CHECK-OUT ---
    const checkoutSheet = workbook.addWorksheet('Calcolo Check-out');
    checkoutSheet.mergeCells('A1:D1');
    const coTitle = checkoutSheet.getCell('A1');
    coTitle.value = "🧾 Modulo Calcolo Check-out (Ricevuta)";
    coTitle.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    coTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
    coTitle.alignment = { vertical: 'middle', horizontal: 'center' };
    checkoutSheet.getRow(1).height = 30;

    const coData = [
      ["Descrizione Servizio", "Quantità/Notti", "Prezzo Unitario", "Subtotale"],
      ["Soggiorno Camera Standard", 1, 80, { formula: 'B3*C3' }],
      ["Servizi Extra (Bar/Mini-frigo)", 0, 1, { formula: 'B4*C4' }],
      ["Tassa di Soggiorno", 1, 3.5, { formula: 'B5*C5' }],
      ["", "", "", ""],
      ["TOTALE DA PAGARE", "", "", { formula: 'SUM(D3:D5)' }]
    ];

    coData.forEach((rowData, index) => {
      const row = checkoutSheet.addRow(rowData);
      row.height = 25;
      row.eachCell((cell, colNum) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        cell.alignment = { vertical: 'middle', horizontal: index === 0 ? 'center' : 'left' };
        
        if (index === 0) {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
        }
        
        if (index === coData.length - 1) {
          cell.font = { bold: true, size: 12 };
          if (colNum === 4) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            cell.font = { bold: true, size: 12, color: { argb: 'FF065F46' } };
          }
        }

        if (colNum >= 3 && index > 0) {
          cell.numFmt = '"€" #,##0.00';
        }
      });
    });
    checkoutSheet.columns = [{ width: 30 }, { width: 15 }, { width: 15 }, { width: 15 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, 'hotel_da_pippino_modello_excel_premium.xlsx');
  };

  const exportToCSV = () => {
    // In Excel: File -> Salva con nome -> CSV (delimitato dal separatore di elenco)
    if (guests.length === 0) {
      alert('Nessun dato da esportare.');
      return;
    }

    const headers = ['ID', 'Nome', 'Camera', 'Check-in'];
    const csvRows = [
      headers.join(','),
      ...guests.map(g => `${g.id},"${g.name.replace(/"/g, '""')}",${g.room},${g.checkIn}`)
    ];

    const csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(csvRows.join('\n'));
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", "registro_clienti.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalCost = (nights * roomRate) + (extras || 0);

  // ==========================================
  // FUNZIONI ADMIN
  // ==========================================
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In Excel: Protezione Foglio con password
    if (password === 'admin123') {
      setIsAdmin(true);
      setShowLogin(false);
      setPassword('');
    } else {
      alert('Password errata. Suggerimento: admin123');
    }
  };

  const handleDeleteGuest = (id: string) => {
    // In Excel: Eliminazione intera riga
    setGuests(guests.filter(g => g.id !== id));
  };

  const startEditGuest = (guest: Guest) => {
    setEditingGuestId(guest.id);
    setEditFormData({ name: guest.name, room: guest.room, checkIn: guest.checkIn });
  };

  const saveEditGuest = () => {
    // In Excel: Sovrascrittura del valore della cella
    setGuests(guests.map(g => g.id === editingGuestId ? { ...g, ...editFormData } : g));
    setEditingGuestId(null);
  };

  const cancelEditGuest = () => {
    setEditingGuestId(null);
  };

  const downloadProject = async () => {
    const zip = new JSZip();
    
    // Lista dei file da includere (percorso relativo)
    const files = [
      'package.json',
      'vite.config.ts',
      'tsconfig.json',
      'index.html',
      'metadata.json',
      '.env.example',
      'src/main.tsx',
      'src/App.tsx',
      'src/index.css'
    ];

    try {
      for (const file of files) {
        const response = await fetch(`/${file}`);
        if (response.ok) {
          const content = await response.text();
          zip.file(file, content);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'da_pippino_progetto_locale.zip');
    } catch (error) {
      console.error('Errore durante il download del progetto:', error);
      alert('Si è verificato un errore durante la creazione del pacchetto. Riprova.');
    }
  };

  // ==========================================
  // RENDER COMPONENTI
  // ==========================================

  // Modale di Login
  const LoginModal = () => (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Lock size={20} className="text-indigo-600" />
            Accesso Admin
          </h3>
          <button onClick={() => setShowLogin(false)} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-6">
          <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Rimuovi Protezione Foglio</span><br/>
          Inserisci la password per accedere alla modalità amministratore. (Password: admin123)
        </p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              placeholder="Inserisci password..."
              autoFocus
            />
          </div>
          <button type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors">
            Accedi
          </button>
        </form>
      </div>
    </div>
  );

  // --- COMPONENTE GUIDA EXCEL ---
  const ExcelGuide = () => (
    <div className="min-h-screen bg-[#fdfaf6] p-4 md:p-12 font-serif text-slate-800 print:bg-white print:p-0">
      <div className="max-w-4xl mx-auto bg-white shadow-lg border border-orange-100 rounded-3xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
        
        {/* Copertina Guida */}
        <div className="bg-slate-900 text-white p-8 md:p-12 flex flex-col md:flex-row items-center gap-8 border-b-8 border-orange-400">
          <Logo />
          <div className="text-center md:text-left">
            <h1 className="text-4xl font-bold mb-2 tracking-tight">Guida Pratica Excel: Hotel "Da Pippino"</h1>
            <p className="text-orange-200 text-lg italic">Addetto alla Reception</p>
            <div className="mt-6 pt-6 border-t border-slate-700 text-sm opacity-80">
              <p>Progetto didattico a cura di <strong>Indennitate Maria Grazia</strong></p>
              <p>Scuola di formazione <strong>Leonardo da Vinci / Genesis</strong>, Monteroni di Lecce</p>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-12 space-y-12">
          
          {/* Introduzione */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">1. Obiettivo del Progetto</h2>
            <p className="leading-relaxed">
              Questa guida ti insegnerà a trasformare un semplice foglio di calcolo in un potente strumento di gestione alberghiera. 
              Imparerai a gestire il <strong>Tableau</strong>, il <strong>Registro Clienti</strong> e il <strong>Calcolo del Check-out</strong> usando formule e automazioni professionali.
            </p>
          </section>

          {/* Foglio 1: Tableau */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">2. Foglio "Tableau": La Griglia Visiva</h2>
            <div className="space-y-4">
              <p><strong>Obiettivo:</strong> Creare una mappa visiva delle camere per monitorare le disponibilità a colpo d'occhio.</p>
              
              <div className="bg-orange-50 p-6 rounded-xl border-l-4 border-orange-400">
                <h3 className="font-bold text-orange-900 mb-3">Guida Passo-Passo: Formattazione Condizionale</h3>
                <p className="text-sm mb-3">Segui questi passaggi per colorare le celle automaticamente:</p>
                <ol className="list-decimal list-inside text-sm space-y-2">
                  <li><strong>Seleziona l'intervallo:</strong> Evidenzia con il mouse le celle della griglia (es. da <code className="bg-white px-1">B2</code> a <code className="bg-white px-1">H6</code>).</li>
                  <li><strong>Apri lo strumento:</strong> Nella scheda <strong>Home</strong>, clicca su <strong>Formattazione Condizionale</strong>.</li>
                  <li><strong>Nuova Regola:</strong> Scegli <strong>Regole evidenziazione celle</strong> &gt; <strong>Testo contenente...</strong></li>
                  <li><strong>Configura:</strong> 
                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                      <li>Scrivi <span className="font-bold">"Occupata"</span> e imposta il riempimento <span className="text-rose-600 font-bold">Rosso Chiaro</span>.</li>
                      <li>Ripeti l'operazione scrivendo <span className="font-bold">"Libera"</span> con riempimento <span className="text-emerald-600 font-bold">Verde</span>.</li>
                      <li>Ripeti scrivendo <span className="font-bold">"Prenotata"</span> con riempimento <span className="text-blue-600 font-bold">Blu</span>.</li>
                      <li>Ripeti scrivendo <span className="font-bold">"Pulizia"</span> con riempimento <span className="text-amber-600 font-bold">Giallo</span>.</li>
                      <li>Ripeti scrivendo <span className="font-bold">"Manutenzione"</span> con riempimento <span className="text-slate-600 font-bold">Grigio</span>.</li>
                    </ul>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          {/* Foglio 2: Registro */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">3. Foglio "Registro": Database Clienti</h2>
            <div className="space-y-4">
              <p><strong>Obiettivo:</strong> Archiviare i dati dei clienti in modo ordinato e senza errori di battitura.</p>
              
              <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-blue-400">
                <h3 className="font-bold text-blue-900 mb-3">Guida Passo-Passo: Convalida Dati</h3>
                <p className="text-sm mb-3">Per creare il menu a tendina delle camere e evitare errori:</p>
                <ol className="list-decimal list-inside text-sm space-y-2">
                  <li><strong>Seleziona la cella:</strong> Clicca sulla cella della colonna "Camera" (es. <code className="bg-white px-1">C2</code>).</li>
                  <li><strong>Apri lo strumento:</strong> Vai nella scheda <strong>Dati</strong> e clicca su <strong>Convalida Dati</strong>.</li>
                  <li><strong>Imposta i criteri:</strong> Nel campo "Consenti", seleziona <span className="font-bold">Elenco</span>.</li>
                  <li><strong>Inserisci i valori:</strong> Nel campo "Origine", digita i numeri delle camere separati dal punto e virgola: <br/>
                    <code className="bg-white px-2 py-1 rounded border border-blue-200 block mt-2 text-center font-mono">101;102;103;104;105</code>
                  </li>
                  <li><strong>Conferma:</strong> Clicca OK. Ora apparirà una freccetta per scegliere la camera.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* Foglio 3: Check-out */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">4. Foglio "Check-out": Calcolo del Conto</h2>
            <div className="space-y-4">
              <p><strong>Obiettivo:</strong> Emettere il conto finale sommando il costo del soggiorno e i servizi extra.</p>
              
              <div className="bg-emerald-50 p-6 rounded-xl border-l-4 border-emerald-400">
                <h3 className="font-bold text-emerald-900 mb-3">La Formula del Totale</h3>
                <p className="text-sm mb-3">Supponiamo di avere i dati in queste celle:</p>
                <ul className="text-sm space-y-1 mb-4">
                  <li>Cella <code className="bg-white px-1">A10</code>: Numero di Notti</li>
                  <li>Cella <code className="bg-white px-1">B10</code>: Costi Extra (Bar, Spa, ecc.)</li>
                  <li>Tariffa Camera: <span className="font-bold">80,00 €</span></li>
                </ul>
                <p className="text-sm font-bold mb-2">Sintassi completa da scrivere in Excel:</p>
                <div className="bg-slate-900 text-emerald-400 p-4 rounded-lg font-mono text-xl text-center mb-4">
                  =(A10 * 80) + B10
                </div>
                <p className="text-sm">
                  <strong>Spiegazione:</strong> Il simbolo <code className="bg-slate-200 px-1">*</code> indica la moltiplicazione. Excel calcola prima la parentesi (Notti x 80) e poi aggiunge il valore degli Extra.
                </p>
              </div>
            </div>
          </section>

          {/* Formule Avanzate */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">5. Formule Avanzate e Statistiche</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border border-slate-200 rounded-xl p-6 hover:bg-slate-50 transition-colors">
                <h3 className="font-bold text-indigo-600 mb-2">CERCA.VERT (Ricerca Automatica)</h3>
                <p className="text-sm mb-4 text-slate-600">Serve per recuperare il numero di camera scrivendo solo il nome del cliente.</p>
                <div className="bg-slate-900 text-indigo-300 p-4 rounded-lg font-mono text-xs leading-relaxed">
                  =CERCA.VERT(H2; A2:C100; 2; FALSO)
                </div>
                <div className="mt-4 text-xs space-y-1 text-slate-500">
                  <p>• <span className="font-bold">H2:</span> Cosa cerco (il nome).</p>
                  <p>• <span className="font-bold">A2:C100:</span> Dove cerco (il registro).</p>
                  <p>• <span className="font-bold">2:</span> Colonna del risultato (Camera).</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-6 hover:bg-slate-50 transition-colors">
                <h3 className="font-bold text-emerald-600 mb-2">CONTA.SE (Statistiche)</h3>
                <p className="text-sm mb-4 text-slate-600">Conta quante camere sono attualmente occupate nel Tableau.</p>
                <div className="bg-slate-900 text-emerald-300 p-4 rounded-lg font-mono text-xs leading-relaxed">
                  =CONTA.SE(B2:H6; "Occupata")
                </div>
                <div className="mt-4 text-xs space-y-1 text-slate-500">
                  <p>• <span className="font-bold">B2:H6:</span> L'area del Tableau.</p>
                  <p>• <span className="font-bold">"Occupata":</span> Il criterio di ricerca.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Calendario Dinamico */}
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4 border-b-2 border-orange-200 pb-2">6. Calendario Dinamico</h2>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <p className="text-sm mb-4">Per far sì che le date si aggiornino da sole ogni giorno:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-400">Cella B1 (Oggi)</p>
                  <div className="bg-white border border-slate-200 p-3 rounded font-mono text-indigo-600">=OGGI()</div>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase text-slate-400">Cella C1 (Domani)</p>
                  <div className="bg-white border border-slate-200 p-3 rounded font-mono text-indigo-600">=B1 + 1</div>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-4 italic">Nota: Trascina la formula di C1 verso destra per coprire tutta la settimana.</p>
            </div>
          </section>

          {/* Uso Offline */}
          <section className="bg-indigo-50 p-8 rounded-3xl border border-indigo-100">
            <h2 className="text-xl font-bold text-indigo-900 mb-4 flex items-center gap-2">
              <Package size={20} className="text-indigo-600" />
              7. Uso Offline (Sul tuo PC)
            </h2>
            <p className="text-sm mb-4 leading-relaxed">
              Puoi scaricare questo intero progetto e usarlo sul tuo computer senza internet. Ecco come fare:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-3 text-slate-700">
              <li>Vai nel <strong>Pannello Admin</strong> (Password: <code className="bg-white px-1 rounded">admin123</code>).</li>
              <li>Clicca sul pulsante <strong>"Scarica Progetto Locale"</strong>.</li>
              <li>Estrai il file ZIP sul tuo computer.</li>
              <li>Assicurati di avere <a href="https://nodejs.org/" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Node.js</a> installato.</li>
              <li>Apri il terminale nella cartella del progetto e digita:
                <div className="bg-slate-900 text-indigo-300 p-3 rounded mt-2 font-mono text-xs">
                  npm install<br/>
                  npm run dev
                </div>
              </li>
              <li>Apri il browser all'indirizzo che apparirà (solitamente <code className="bg-slate-800 text-white px-1">localhost:3000</code>).</li>
            </ol>
          </section>

          {/* Glossario */}
          <section className="bg-slate-50 p-8 rounded-3xl border border-slate-200">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Calculator size={20} className="text-orange-500" />
              Glossario Rapido del Receptionist
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex gap-2"><strong>Tableau:</strong> La griglia delle disponibilità.</div>
              <div className="flex gap-2"><strong>Check-in:</strong> Registrazione arrivo cliente.</div>
              <div className="flex gap-2"><strong>Check-out:</strong> Saldo conto e partenza.</div>
              <div className="flex gap-2"><strong>No-Show:</strong> Cliente prenotato che non si presenta.</div>
              <div className="flex gap-2"><strong>Overbooking:</strong> Più prenotazioni che camere.</div>
              <div className="flex gap-2"><strong>Room Status:</strong> Stato della camera (Libera/Prenotata/Occupata/Pulizia/Manutenzione).</div>
            </div>
          </section>

          {/* Footer Guida */}
          <footer className="text-center pt-8 border-t border-slate-100">
            <p className="mt-6 text-xs text-slate-400 uppercase tracking-widest">
              Leonardo da Vinci / Genesis
            </p>
          </footer>
        </div>
      </div>
      
      <button 
        onClick={() => setShowGuide(false)}
        className="fixed bottom-8 right-8 px-6 py-3 bg-white shadow-2xl border border-slate-200 rounded-full font-bold text-slate-700 hover:bg-slate-50 transition-all print:hidden"
      >
        Torna al Gestionale
      </button>
    </div>
  );

  // Vista Admin
  if (isAdmin) {
    return (
      <div className="min-h-screen bg-indigo-50/50 p-6 font-sans text-slate-800 print:bg-white print:p-0">
        <div className="max-w-6xl mx-auto space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 print:hidden">
            <div className="flex items-center gap-4">
              <Logo />
              <div>
                <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded mb-2">
                  Corso di Formazione: Addetto alla Reception
                </span>
                <h1 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                  <Lock size={24} className="text-indigo-600" />
                  Da Pippino - Pannello Admin
                </h1>
                <p className="text-indigo-600/70 mt-1 text-sm">Gestione avanzata della struttura</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-sm font-medium shadow-sm"
              >
                <FileSpreadsheet size={16} />
                Scarica Modello Excel
              </button>
              <button 
                onClick={downloadProject}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors text-sm font-medium shadow-sm"
              >
                <Package size={16} />
                Scarica Progetto Locale
              </button>
              <button 
                onClick={() => setIsAdmin(false)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors text-sm font-medium"
              >
                <LogOut size={16} />
                Torna alla Reception
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Admin: Gestione Tableau */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-slate-800">Impostazione Iniziale Tableau</h2>
                <p className="text-sm text-slate-500 mt-1">
                  <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Modifica Template / Valori Predefiniti</span><br/>
                  Imposta lo stato di partenza delle camere per la settimana corrente.
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-medium">Camera</th>
                      {calendarDays.map(day => (
                        <th key={day.fullDate} className="px-4 py-3 font-medium text-center">
                          <div className="capitalize">{day.name}</div>
                          <div className="text-[10px] opacity-60">{day.date}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room, rIndex) => (
                      <tr key={room} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-700">{room}</td>
                        {calendarDays.map((day, dIndex) => {
                          const status = grid[rIndex][dIndex];
                          return (
                            <td key={`${room}-${day.fullDate}`} className="px-2 py-2 text-center">
                              <button
                                onClick={() => toggleCellStatus(rIndex, dIndex)}
                                className={`w-full py-2 px-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${getStatusColor(status)}`}
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Admin: Gestione Clienti */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Gestione Completa Clienti</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Modifica/Eliminazione Righe Database</span><br/>
                    Modifica o elimina le registrazioni esistenti.
                  </p>
                </div>
                <button 
                  onClick={exportToCSV}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors border border-emerald-200"
                >
                  <Download size={16} />
                  Esporta CSV
                </button>
              </div>

              <div className="border border-slate-100 rounded-xl overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome</th>
                      <th className="px-4 py-3 font-medium">Camera</th>
                      <th className="px-4 py-3 font-medium">Check-in</th>
                      <th className="px-4 py-3 font-medium text-right">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                          Nessun cliente nel database.
                        </td>
                      </tr>
                    ) : (
                      guests.map(guest => (
                        <tr key={guest.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          {editingGuestId === guest.id ? (
                            <>
                              <td className="px-2 py-2">
                                <input 
                                  type="text" 
                                  value={editFormData.name}
                                  onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                                  className="w-full px-2 py-1 bg-white border border-indigo-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-2 py-2">
                                <select 
                                  value={editFormData.room}
                                  onChange={e => setEditFormData({...editFormData, room: e.target.value})}
                                  className="w-full px-2 py-1 bg-white border border-indigo-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                                >
                                  {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                              </td>
                              <td className="px-2 py-2">
                                <input 
                                  type="date" 
                                  value={editFormData.checkIn}
                                  onChange={e => setEditFormData({...editFormData, checkIn: e.target.value})}
                                  className="w-full px-2 py-1 bg-white border border-indigo-200 rounded text-sm focus:outline-none focus:border-indigo-500"
                                />
                              </td>
                              <td className="px-2 py-2 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={saveEditGuest} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Salva">
                                    <Check size={16} />
                                  </button>
                                  <button onClick={cancelEditGuest} className="p-1 text-slate-400 hover:bg-slate-100 rounded" title="Annulla">
                                    <X size={16} />
                                  </button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-medium text-slate-700">{guest.name}</td>
                              <td className="px-4 py-3 text-slate-600">{guest.room}</td>
                              <td className="px-4 py-3 text-slate-600">{guest.checkIn}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button onClick={() => startEditGuest(guest)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Modifica">
                                    <Edit2 size={16} />
                                  </button>
                                  <button onClick={() => handleDeleteGuest(guest.id)} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Elimina">
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  // Vista Guida
  if (showGuide) {
    return <ExcelGuide />;
  }

  // Vista Receptionist (Default)
  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-800 relative print:bg-white print:p-0">
      {showLogin && <LoginModal />}
      
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 print:hidden">
          <div className="flex items-center gap-4">
            <Logo />
            <div>
              <span className="inline-block px-2 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded mb-2">
                Progetto Didattico: Addetto alla Reception
              </span>
              <h1 className="text-3xl font-bold text-slate-700 tracking-tight">Da Pippino</h1>
              <div className="flex items-center gap-2 text-slate-500 mt-1 text-sm">
                <p>Piattaforma di formazione per receptionist</p>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <div className="flex items-center gap-1 font-mono text-indigo-600 font-bold">
                  <Clock size={14} />
                  <span className="capitalize">{currentDateStr}</span>
                  <span className="ml-1 px-2 py-0.5 bg-indigo-600 text-white rounded text-xs">{currentTime}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={exportToExcel}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all text-sm font-medium shadow-sm group"
              title="Scarica il file Excel di esempio"
            >
              <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform" />
              Modello Excel
            </button>
            <button 
              onClick={() => setShowGuide(true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl transition-all text-sm font-bold shadow-md shadow-orange-200 group"
            >
              <Download size={16} className="group-hover:translate-y-0.5 transition-transform" />
              Guida Excel Studente
            </button>
            <button 
              onClick={() => setShowLogin(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl transition-colors text-sm font-medium shadow-sm"
            >
              <Lock size={16} />
              Accesso Admin
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Colonna Sinistra: Tableau */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Sezione 1: Tableau Interattivo */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                  <CalendarDays size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Tableau Camere</h2>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Formattazione Condizionale (Settimana Reale)</span>
                  </p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3 font-medium">Camera</th>
                      {calendarDays.map(day => (
                        <th key={day.fullDate} className="px-4 py-3 font-medium text-center">
                          <div className="capitalize">{day.name}</div>
                          <div className="text-[10px] opacity-60">{day.date}</div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rooms.map((room, rIndex) => (
                      <tr key={room} className="border-b border-slate-50 last:border-0">
                        <td className="px-4 py-3 font-medium text-slate-700">{room}</td>
                        {calendarDays.map((day, dIndex) => {
                          const status = grid[rIndex][dIndex];
                          return (
                            <td key={`${room}-${day.fullDate}`} className="px-2 py-2 text-center">
                              <button
                                onClick={() => toggleCellStatus(rIndex, dIndex)}
                                className={`w-full py-2 px-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${getStatusColor(status)}`}
                                title="Clicca per cambiare stato"
                              >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500 justify-center">
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-200"></span> Libera</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-200"></span> Prenotata</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-200"></span> Occupata</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-amber-200"></span> In pulizia</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-300"></span> In manutenzione</div>
              </div>
            </section>

            {/* Sezione 2: Registro Clienti */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                  <Users size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Registro Clienti</h2>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Inserimento Dati & Filtro</span>
                  </p>
                </div>
              </div>

              {/* Form Inserimento */}
              <form onSubmit={handleAddGuest} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-slate-50 p-4 rounded-xl border border-slate-100 items-start">
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Nome Cliente</label>
                  <input 
                    type="text" 
                    value={formData.name}
                    onChange={e => {
                      setFormData({...formData, name: e.target.value});
                      if (formErrors.name) setFormErrors({...formErrors, name: ''});
                    }}
                    className={`w-full px-3 py-2 bg-white border ${formErrors.name ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-lg text-sm focus:outline-none focus:ring-2`}
                    placeholder="Es. Mario Rossi"
                  />
                  {formErrors.name && <p className="text-rose-500 text-xs mt-1">{formErrors.name}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Camera</label>
                  <select 
                    value={formData.room}
                    onChange={e => {
                      setFormData({...formData, room: e.target.value});
                      if (formErrors.room) setFormErrors({...formErrors, room: ''});
                    }}
                    className={`w-full px-3 py-2 bg-white border ${formErrors.room ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-lg text-sm focus:outline-none focus:ring-2`}
                  >
                    <option value="">Seleziona...</option>
                    {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {formErrors.room && <p className="text-rose-500 text-xs mt-1">{formErrors.room}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data Check-in</label>
                  <input 
                    type="date" 
                    value={formData.checkIn}
                    onChange={e => {
                      setFormData({...formData, checkIn: e.target.value});
                      if (formErrors.checkIn) setFormErrors({...formErrors, checkIn: ''});
                    }}
                    className={`w-full px-3 py-2 bg-white border ${formErrors.checkIn ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-500' : 'border-slate-200 focus:ring-blue-500/20 focus:border-blue-500'} rounded-lg text-sm focus:outline-none focus:ring-2`}
                  />
                  {formErrors.checkIn && <p className="text-rose-500 text-xs mt-1">{formErrors.checkIn}</p>}
                </div>
                <div className="flex items-end h-[60px]">
                  <button type="submit" className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg transition-colors">
                    Aggiungi
                  </button>
                </div>
              </form>

              {/* Ricerca e Tabella */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Cerca per nome (Filtro Excel)..." 
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div className="relative">
                    <input 
                      type="date" 
                      value={filterDate}
                      onChange={e => setFilterDate(e.target.value)}
                      className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      title="Filtra per data di check-in"
                    />
                    {filterDate && (
                      <button 
                        onClick={() => setFilterDate('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={exportToCSV}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
                    title="Esporta in CSV"
                  >
                    <Download size={16} />
                    Esporta CSV
                  </button>
                </div>

                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-4 py-3 font-medium">Nome</th>
                        <th className="px-4 py-3 font-medium">Camera</th>
                        <th className="px-4 py-3 font-medium">Check-in</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGuests.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-8 text-center text-slate-400">
                            Nessun cliente registrato.
                          </td>
                        </tr>
                      ) : (
                        filteredGuests.map(guest => (
                          <tr key={guest.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-medium text-slate-700">{guest.name}</td>
                            <td className="px-4 py-3 text-slate-600">{guest.room}</td>
                            <td className="px-4 py-3 text-slate-600">{guest.checkIn}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

          </div>

          {/* Colonna Destra: Calcolatore */}
          <div className="space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 sticky top-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                  <Calculator size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-800">Check-out</h2>
                  <p className="text-sm text-slate-500">
                    <span className="font-mono bg-slate-100 px-1 rounded text-xs">Excel: Formule Matematiche</span>
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Notti (Tariffa: 80€)
                  </label>
                  <input 
                    type="number" 
                    min="1"
                    value={nights}
                    onChange={e => setNights(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-mono">Cella A1</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">
                    Costi Extra (€)
                  </label>
                  <input 
                    type="number" 
                    min="0"
                    value={extras}
                    onChange={e => setExtras(parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs text-slate-400 mt-1 font-mono">Cella B1</p>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                    <p className="text-sm text-emerald-800 font-medium mb-1">Totale da pagare</p>
                    <div className="text-3xl font-bold text-emerald-900">
                      € {totalCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-emerald-600/70 mt-2 font-mono">
                      Formula: =(A1 * 80) + B1
                    </p>
                  </div>
                </div>
                
                <button className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-emerald-600/20">
                  Emetti Ricevuta
                </button>
              </div>
            </section>
          </div>

        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-12 pb-8 text-center border-t border-slate-200 pt-8">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mb-2">
          Progetto Didattico per il corso di formazione: Addetto alla Reception
        </p>
        <p className="text-sm text-slate-500 font-semibold italic max-w-2xl mx-auto">
          Progetto didattico a cura di Indennitate Maria Grazia per la scuola di formazione Leonardo da Vinci/Genesis, Monteroni di Lecce
        </p>
      </footer>
    </div>
  );
}
