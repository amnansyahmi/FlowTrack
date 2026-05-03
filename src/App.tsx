import { 
  Plus, 
  Home, 
  DollarSign, 
  CreditCard, 
  CheckSquare, 
  Settings, 
  ChevronRight,
  Filter,
  Calendar,
  Image as ImageIcon,
  Check,
  X,
  Trash2,
  PieChart,
  Target,
  Download,
  Upload,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  BarChart3,
  BookOpen,
  Camera,
  Layers,
  Copy,
  TrendingUp,
  FileText,
  AlertCircle,
  History
} from 'lucide-react';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, getMonth, getYear, addDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { createWorker } from 'tesseract.js';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart as RePieChart,
  Pie
} from 'recharts';
import { 
  openDB, 
  getAll, 
  add, 
  update, 
  remove, 
  Category, 
  Income, 
  Expense, 
  Commitment, 
  CommitmentLog, 
  Receipt,
  Goal,
  GoalContribution,
  Budget,
  Debt,
  DebtPayment,
  MonthlySnapshot
} from './lib/db';

// --- Types ---
type View = 'Home' | 'Income' | 'Expenses' | 'Commitments' | 'Goals' | 'Budgets' | 'Debts' | 'Reports' | 'Settings';

// --- Components ---

const TooltipProvider = ({ children, content }: { children: React.ReactNode, content: string }) => (
  <div className="relative group flex items-center">
    {children}
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
      {content}
    </div>
  </div>
);

const BottomNav = ({ activeView, setView }: { activeView: View, setView: (v: View) => void }) => {
  const tabs: { label: View, icon: any }[] = [
    { label: 'Home', icon: Home },
    { label: 'Income', icon: DollarSign },
    { label: 'Expenses', icon: CreditCard },
    { label: 'Commitments', icon: CheckSquare },
    { label: 'Goals', icon: Target },
    { label: 'Budgets', icon: Layers },
    { label: 'Debts', icon: BookOpen },
    { label: 'Reports', icon: BarChart3 },
    { label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-50 overflow-hidden">
      <div className="flex overflow-x-auto no-scrollbar items-center h-20 px-4 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setView(tab.label)}
            className={`flex flex-col items-center justify-center min-w-[70px] h-full transition-colors ${
              activeView === tab.label ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <tab.icon size={20} strokeWidth={activeView === tab.label ? 2.5 : 2} />
            <span className="text-[9px] mt-1 font-bold uppercase tracking-tighter whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

const Header = ({ title, subtitle, onAdd }: { title: string, subtitle?: string, onAdd?: () => void }) => (
  <header className="fixed top-0 left-0 right-0 bg-[#F2F2F7]/80 backdrop-blur-md z-40 safe-top">
    <div className="flex justify-between items-end px-6 pt-4 pb-2 h-20">
      <div className="space-y-0.5">
        {subtitle && <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{subtitle}</p>}
        <h1 className="text-3xl font-black tracking-tight text-black">{title}</h1>
      </div>
      {onAdd ? (
        <button 
          onClick={onAdd}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-blue-600 text-white shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      ) : (
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200">
           <Settings size={20} className="text-blue-600" />
        </div>
      )}
    </div>
  </header>
);

const Card = ({ children, className = "", key }: { children: React.ReactNode, className?: string, key?: React.Key }) => (
  <div key={key} className={`bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 ${className}`}>
    {children}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState<View>('Home');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Data State
  const [categories, setCategories] = useState<Category[]>([]);
  const [income, setIncome] = useState<Income[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [commitmentLogs, setCommitmentLogs] = useState<CommitmentLog[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);
  const [snapshots, setSnapshots] = useState<MonthlySnapshot[]>([]);
  
  // UI State
  const [isReady, setIsReady] = useState(false);
  const [showAddModal, setShowAddModal] = useState<View | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<string | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [savingsTarget, setSavingsTarget] = useState(0);

  const monthStr = format(currentDate, 'MMMM yyyy');
  const monthYearKey = format(currentDate, 'yyyy-MM');

  const initialized = useRef(false);

  // Load Data
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        await openDB();
        const cats = await getAll<Category>('categories');
        const inc = await getAll<Income>('income');
        const exp = await getAll<Expense>('expenses');
        const com = await getAll<Commitment>('commitments');
        const logs = await getAll<CommitmentLog>('commitmentLogs');
        const rec = await getAll<Receipt>('receipts');
        const g = await getAll<Goal>('goals');
        const gc = await getAll<GoalContribution>('goalContributions');

        // Initial default categories if none exist
        if (cats.length === 0) {
          const defaultCats: Category[] = [
            { id: '1', name: 'Food', icon: '🍔', type: 'expense' },
            { id: '2', name: 'Transport', icon: '🚗', type: 'expense' },
            { id: '3', name: 'Bills', icon: '📄', type: 'expense' },
            { id: '4', name: 'Shopping', icon: '🛍️', type: 'expense' },
            { id: '5', name: 'Groceries', icon: '🛒', type: 'expense' },
            { id: '6', name: 'Healthcare', icon: '🏥', type: 'expense' },
            { id: '7', name: 'Entertainment', icon: '🎮', type: 'expense' },
            { id: '8', name: 'Family', icon: '👨‍👩-👧', type: 'expense' },
            { id: '9', name: 'Debt', icon: '📉', type: 'expense' },
            { id: '10', name: 'Others', icon: '🏷️', type: 'expense' },
            { id: '101', name: 'Salary', icon: '💰', type: 'income' },
            { id: '102', name: 'Refunding', icon: '🔙', type: 'income' },
            { id: '103', name: 'Others', icon: '➕', type: 'income' },
            { id: '201', name: 'Rent', icon: '🏠', type: 'commitment' },
            { id: '202', name: 'Loan', icon: '🏦', type: 'commitment' },
            { id: '203', name: 'Others', icon: '📦', type: 'commitment' },
          ];
          for (const c of defaultCats) await update('categories', c);
          setCategories(defaultCats);
        } else {
          setCategories(cats);
        }

        setIncome(inc);
        setExpenses(exp);
        setCommitments(com);
        setCommitmentLogs(logs);
        setReceipts(rec);
        setGoals(g);
        setGoalContributions(gc);
        
        const bud = await getAll<Budget>('budgets');
        const dbt = await getAll<Debt>('debts');
        const dp = await getAll<DebtPayment>('debtPayments');
        const snp = await getAll<MonthlySnapshot>('monthlySnapshots');
        
        setBudgets(bud);
        setDebts(dbt);
        setDebtPayments(dp);
        setSnapshots(snp);

        setIsReady(true);
      } catch (err) {
        console.error("DB Init failed", err);
      }
    }
    init();
  }, []);

  // Filtered Data for Current Month
  const currentMonthIncome = useMemo(() => {
    return income.filter(i => {
      if (i.isSalary && i.monthKey === monthYearKey) return true;
      const d = parseISO(i.date);
      return format(d, 'yyyy-MM') === monthYearKey;
    });
  }, [income, monthYearKey]);

  const currentMonthExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = parseISO(e.date);
      return format(d, 'yyyy-MM') === monthYearKey;
    });
  }, [expenses, monthYearKey]);

  const currentMonthCommitmentLogs = useMemo(() => {
    return commitmentLogs.filter(l => l.monthYear === monthYearKey);
  }, [commitmentLogs, monthYearKey]);

  const currentMonthDebtPayments = useMemo(() => {
    return debtPayments.filter(p => format(parseISO(p.date), 'yyyy-MM') === monthYearKey);
  }, [debtPayments, monthYearKey]);

  const currentMonthSavingsAllocations = useMemo(() => {
    return goalContributions.filter(c => c.monthYear === monthYearKey);
  }, [goalContributions, monthYearKey]);

  // Calculations
  const stats = useMemo(() => {
    const totalIncome = currentMonthIncome.reduce((acc, curr) => acc + curr.amount, 0);
    const totalExpenses = currentMonthExpenses.reduce((acc, curr) => acc + curr.amount, 0);
    const totalCommitmentAmount = commitments.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Unpaid commitments: not in logs or status unpaid
    const paidCommitmentIds = currentMonthCommitmentLogs.filter(l => l.status === 'paid').map(l => l.commitmentId);
    const unpaidCommitmentsAmount = commitments.filter(c => !paidCommitmentIds.includes(c.id)).reduce((acc, curr) => acc + curr.amount, 0);
    
    const paidCommitmentAmount = totalCommitmentAmount - unpaidCommitmentsAmount;

    // Savings Allocation
    const savingsAllocation = currentMonthSavingsAllocations.reduce((acc, curr) => acc + curr.amount, 0);
    
    // Planned Debt Payments
    const totalPlannedDebtPayments = debts.reduce((acc, curr) => acc + curr.monthlyPayment, 0);
    const actualDebtPaymentsAmount = currentMonthDebtPayments.reduce((acc, curr) => acc + curr.amount, 0);
    const remainingPlannedDebtPayments = Math.max(0, totalPlannedDebtPayments - actualDebtPaymentsAmount);

    // Safe to Spend = Total Income - Total Expenses - Unpaid Commitments - Savings Allocation - Planned Debt Payments
    const safeToSpend = totalIncome - totalExpenses - unpaidCommitmentsAmount - savingsAllocation - remainingPlannedDebtPayments;

    return {
      totalIncome,
      totalExpenses,
      totalCommitments: totalCommitmentAmount,
      paidCommitments: paidCommitmentAmount,
      unpaidCommitments: unpaidCommitmentsAmount,
      savingsAllocation,
      debtPayments: actualDebtPaymentsAmount,
      remainingPlannedDebt: remainingPlannedDebtPayments,
      balance: totalIncome - totalExpenses - paidCommitmentAmount - actualDebtPaymentsAmount,
      safeToSpend
    };
  }, [currentMonthIncome, currentMonthExpenses, commitments, currentMonthCommitmentLogs, debts, currentMonthDebtPayments, currentMonthSavingsAllocations]);

  // Handlers
  const toggleCommitment = async (commitmentId: string) => {
    const existingLog = currentMonthCommitmentLogs.find(l => l.commitmentId === commitmentId);
    if (existingLog) {
      const updatedStatus = existingLog.status === 'paid' ? 'unpaid' : 'paid';
      const updatedLog: CommitmentLog = { 
        ...existingLog, 
        status: updatedStatus as 'paid' | 'unpaid',
        paidDate: updatedStatus === 'paid' ? new Date().toISOString() : undefined
      };
      await update('commitmentLogs', updatedLog);
      setCommitmentLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    } else {
      const newLog: CommitmentLog = {
        id: crypto.randomUUID(),
        commitmentId,
        monthYear: monthYearKey,
        status: 'paid',
        paidDate: new Date().toISOString()
      };
      await add('commitmentLogs', newLog);
      setCommitmentLogs(prev => [...prev, newLog]);
    }
  };

  const handleAddData = async (type: View, payload: any) => {
    const id = crypto.randomUUID();
    const item = { ...payload, id };
    
    if (type === 'Income') {
      await add('income', item);
      setIncome(prev => [item, ...prev]);
    } else if (type === 'Expenses') {
      await add('expenses', item);
      setExpenses(prev => [item, ...prev]);
    } else if (type === 'Commitments') {
      await add('commitments', item);
      setCommitments(prev => [item, ...prev]);
    }
    setShowAddModal(null);
  };

  const handleOCR = async (file: File) => {
    setIsScanning(true);
    try {
      const worker = await createWorker('eng');
      const { data: { text, confidence } } = await worker.recognize(file);
      await worker.terminate();
      
      // Parser for Malaysian Receipts
      const lines = text.split('\n').filter(l => l.trim() !== '');
      let merchant = lines[0] || 'Unknown Merchant';
      
      // Specifically look for Maybank
      if (text.toUpperCase().includes('MAYBANK') || text.toUpperCase().includes('MALAYAN BANKING')) {
        merchant = 'Maybank Transfer';
      }

      // Extract Amount
      const amountRegex = /(?:TOTAL|AMOUNT|AMT|RM|CASH)\s*:?\s*(\d+(?:\.\d{2})?)/i;
      const amountMatch = text.match(amountRegex);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;
      
      // Extract Date
      const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
      const dateRegexNamed = /(\d{1,2})\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\s+(\d{4})/i;

      const dateMatch = text.match(dateRegex);
      const dateMatchNamed = text.match(dateRegexNamed);

      let date = format(new Date(), 'yyyy-MM-dd');
      
      if (dateMatchNamed) {
        const d = dateMatchNamed[1];
        const mStr = dateMatchNamed[2].toUpperCase();
        const y = dateMatchNamed[3];
        const months: {[key: string]: string} = {
          'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04', 'MAY': '05', 'JUN': '06',
          'JUL': '07', 'AUG': '08', 'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
        };
        date = `${y}-${months[mStr]}-${d.padStart(2, '0')}`;
      } else if (dateMatch) {
         // simplistic DD/MM/YYYY to YYYY-MM-DD
         const d = dateMatch[1];
         const m = dateMatch[2];
         const y = dateMatch[3].length === 2 ? '20' + dateMatch[3] : dateMatch[3];
         date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }

      setOcrResult({
        merchant,
        amount,
        date,
        confidence,
        raw: text
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  const simulateMaybank = () => {
    setOcrResult({
      merchant: 'Maybank Transfer',
      amount: 250.00,
      date: format(new Date(), 'yyyy-MM-dd'),
      confidence: 98,
      raw: 'MAYBANK MALAYAN BANKING BERHAD\nTransaction Successful\nAmount: RM 250.00\nDate: 03 MAY 2026'
    });
  };

  const closeMonth = async () => {
    if (!confirm(`Close ${monthStr} and archive summary?`)) return;
    
    const snapshot: MonthlySnapshot = {
      id: monthYearKey,
      totals: {
        income: stats.totalIncome,
        expenses: stats.totalExpenses,
        commitments: {
          total: stats.totalCommitments,
          paid: stats.paidCommitments
        },
        savings: stats.savingsAllocation,
        debts: stats.debtPayments,
        balance: stats.balance
      },
      categories: categories.map(c => ({
        id: c.id,
        name: c.name,
        spent: currentMonthExpenses.filter(e => e.categoryId === c.id).reduce((a, b) => a + b.amount, 0)
      })),
      createdAt: new Date().toISOString()
    };
    
    await update('monthlySnapshots', snapshot);
    setSnapshots(prev => [...prev.filter(s => s.id !== snapshot.id), snapshot]);
    alert(`${monthStr} archived successfully.`);
  };

  const handleReceiptUpload = async (e: any, linkedId: string, linkedType: 'expense' | 'commitment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      const receipt: Receipt = {
        id: crypto.randomUUID(),
        data: base64,
        type: file.type,
        name: file.name
      };
      await add('receipts', receipt);
      setReceipts(prev => [...prev, receipt]);

      if (linkedType === 'expense') {
        const expense = expenses.find(e => e.id === linkedId);
        if (expense) {
          const updated = { ...expense, receiptId: receipt.id };
          await update('expenses', updated);
          setExpenses(prev => prev.map(e => e.id === linkedId ? updated : e));
        }
      } else {
        const log = currentMonthCommitmentLogs.find(l => l.commitmentId === linkedId);
        if (log) {
          const updated = { ...log, receiptId: receipt.id };
          await update('commitmentLogs', updated);
          setCommitmentLogs(prev => prev.map(l => l.id === log.id ? updated : l));
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddCategory = async (name: string, icon: string, type: 'income' | 'expense' | 'commitment') => {
    const cat: Category = { id: crypto.randomUUID(), name, icon, type };
    await add('categories', cat);
    setCategories(prev => [...prev, cat]);
  };

  const deleteEntry = async (type: 'income' | 'expenses', id: string) => {
    await remove(type, id);
    if (type === 'income') setIncome(prev => prev.filter(i => i.id !== id));
    else setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Calculations for Expense Breakdown
  const expenseBreakdown = useMemo(() => {
    const categoriesMap: { [key: string]: { name: string, icon: string, amount: number, color: string } } = {};
    const colors = ['bg-orange-400', 'bg-blue-400', 'bg-purple-400', 'bg-pink-400', 'bg-emerald-400'];
    
    currentMonthExpenses.forEach((exp, idx) => {
      const cat = categories.find(c => c.id === exp.categoryId);
      if (cat) {
        if (!categoriesMap[cat.id]) {
          categoriesMap[cat.id] = { name: cat.name, icon: cat.icon, amount: 0, color: colors[Object.keys(categoriesMap).length % colors.length] };
        }
        categoriesMap[cat.id].amount += exp.amount;
      }
    });

    return Object.values(categoriesMap).sort((a, b) => b.amount - a.amount);
  }, [currentMonthExpenses, categories]);

  if (!isReady) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#F2F2F7]">
      <div className="animate-pulse flex flex-col items-center">
        <div className="w-16 h-16 bg-blue-600 rounded-[24px] mb-4 shadow-xl shadow-blue-600/20"></div>
        <div className="h-4 w-32 bg-gray-200 rounded-full"></div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F2F7] pb-24 font-sans text-gray-900">
      <Header 
        title={activeView === 'Home' ? 'FlowTrack' : activeView} 
        subtitle={activeView === 'Home' ? monthStr : undefined}
        onAdd={activeView !== 'Home' && activeView !== 'Settings' ? () => setShowAddModal(activeView) : undefined} 
      />

      <main className="pt-24 px-5 max-w-lg mx-auto">
        <AnimatePresence mode="wait">
          {activeView === 'Home' && (
            <motion.div 
              key="home"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Summary Dashboard */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-[32px] p-6 text-white shadow-xl shadow-blue-900/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70">Safe to Spend</p>
                    <div className="text-4xl font-extrabold mt-1 tracking-tight">RM {stats.safeToSpend.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
                    <TrendingUp size={24} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8 pt-5 border-t border-white/20">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Balance</p>
                    <p className="text-sm font-bold tracking-tight">RM {stats.balance.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] uppercase font-bold tracking-widest opacity-60">Unpaid Bills</p>
                    <p className="text-sm font-bold tracking-tight">RM {stats.unpaidCommitments.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {[
                  { label: 'Income', icon: ArrowUpRight, color: 'text-green-600', bg: 'bg-green-50' },
                  { label: 'Expense', icon: ArrowDownRight, color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Bill', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Scan', icon: Camera, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  { label: 'History', icon: History, color: 'text-amber-600', bg: 'bg-amber-50' }
                ].map((action, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                        if (action.label === 'Scan') {
                           const input = document.createElement('input');
                           input.type = 'file';
                           input.accept = 'image/*';
                           input.onchange = (e: any) => {
                             const file = e.target.files[0];
                             if (file) handleOCR(file);
                           };
                           input.click();
                        } else if (action.label === 'History') {
                           setActiveView('Reports');
                        } else {
                           setShowAddModal(action.label === 'Bill' ? 'Commitments' : (action.label === 'Income' ? 'Income' : action.label + 's') as any);
                        }
                    }}
                    onContextMenu={(e) => {
                      if (action.label === 'Scan') {
                        e.preventDefault();
                        simulateMaybank();
                      }
                    }}
                    className="flex flex-col items-center justify-center min-w-[80px] p-4 bg-white rounded-2xl border border-gray-100 shadow-sm active:scale-95 transition-all"
                  >
                    <div className={`w-10 h-10 ${action.bg} ${action.color} rounded-full flex items-center justify-center mb-2`}>
                      <action.icon size={20} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{action.label}</span>
                    {action.label === 'Scan' && (
                      <span className="text-[8px] text-gray-400 mt-0.5 normal-case font-medium">(Hold to test)</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Cash Flow Forecast (Simple) */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-lg tracking-tight px-1 flex items-center justify-between">
                  Cash Flow Forecast
                  <TooltipProvider content="Estimated month-end balance based on unpaid bills and debts">
                    <AlertCircle size={14} className="text-gray-400" />
                  </TooltipProvider>
                </h4>
                <div className="bg-white p-5 rounded-[32px] border border-gray-100 space-y-4">
                  {[
                    { label: 'Current Balance', amount: stats.balance, type: 'plus' },
                    { label: 'Unpaid Bills', amount: -stats.unpaidCommitments, type: 'minus' },
                    { label: 'Upcoming Debts', amount: -stats.remainingPlannedDebt, type: 'minus' },
                    { label: 'Savings Buffer', amount: -stats.savingsAllocation, type: 'minus' }
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="text-gray-500 font-medium">{item.label}</span>
                      <span className={`font-bold ${item.type === 'plus' ? 'text-green-600' : 'text-red-500'}`}>
                        {item.amount >= 0 ? '+' : ''}RM {Math.abs(item.amount).toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="font-black text-xs uppercase tracking-widest">Projection</span>
                    <span className="text-xl font-black text-black">RM {Math.max(0, stats.safeToSpend).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Progress Toward Savings Target */}
              {savingsTarget > 0 && (
                <Card className="bg-blue-50/50 border-blue-100">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold text-blue-600 uppercase tracking-widest">Monthly Savings Target</h4>
                    <span className="text-sm font-bold">RM {savingsTarget}</span>
                  </div>
                  <div className="h-2 w-full bg-blue-100 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (stats.balance / savingsTarget) * 100)}%` }}
                      className="h-full bg-blue-600"
                    />
                  </div>
                </Card>
              )}

              {/* Due Soon / Upcoming Payments */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-extrabold text-lg tracking-tight">Upcoming Bills</h4>
                  <Clock size={18} className="text-gray-400" />
                </div>
                {commitments
                  .sort((a, b) => a.dueDateDay - b.dueDateDay)
                  .filter(c => !currentMonthCommitmentLogs.find(l => l.commitmentId === c.id && l.status === 'paid'))
                  .slice(0, 3)
                  .map(c => {
                    const today = new Date().getDate();
                    const diff = c.dueDateDay - today;
                    let statusText = `Due in ${diff} days`;
                    let statusColor = "text-gray-500";
                    if (diff === 0) { statusText = "Due Today"; statusColor = "text-orange-600"; }
                    if (diff < 0) { statusText = "Overdue"; statusColor = "text-red-600"; }

                    return (
                      <div key={c.id} className="bg-white border border-gray-100 shadow-sm p-4 rounded-[24px] flex justify-between items-center">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center font-bold text-gray-400 border border-gray-100`}>
                            {c.dueDateDay}
                          </div>
                          <div>
                            <p className="font-bold text-sm tracking-tight">{c.title}</p>
                            <p className={`text-[10px] font-bold uppercase tracking-widest ${statusColor}`}>{statusText}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-sm">RM {c.amount.toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })
                }
                {commitments.filter(c => !currentMonthCommitmentLogs.find(l => l.commitmentId === c.id && l.status === 'paid')).length === 0 && (
                  <p className="text-center text-xs text-gray-400 font-bold py-2 uppercase tracking-widest leading-none">All caught up!</p>
                )}
              </div>

              {/* Commitments Grid */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <h4 className="font-extrabold text-lg tracking-tight">Monthly Commitments</h4>
                  <span className="text-blue-600 text-xs font-bold uppercase tracking-tighter" onClick={() => setActiveView('Commitments')}>View All</span>
                </div>
                {commitments.length === 0 ? (
                   <Card className="text-center py-6 text-gray-400 text-sm">No monthly bills added.</Card>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {commitments.slice(0, 4).map(c => {
                      const log = currentMonthCommitmentLogs.find(l => l.commitmentId === c.id);
                      const isPaid = log?.status === 'paid';
                      return (
                        <div 
                          key={c.id} 
                          onClick={() => toggleCommitment(c.id)}
                          className="bg-white border border-gray-100 shadow-sm p-4 rounded-[24px] flex flex-col justify-between h-28 active:scale-95 transition-transform cursor-pointer"
                        >
                          <div className="flex justify-between items-start">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPaid ? 'bg-green-100' : 'bg-red-100'}`}>
                              <div className={`w-2 h-2 rounded-full ${isPaid ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${
                              isPaid ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                            }`}>
                              {isPaid ? 'PAID' : 'UNPAID'}
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-[11px] text-gray-500 font-bold truncate max-w-full">{c.title}</p>
                            <p className="text-[13px] font-black text-black tracking-tight">RM {c.amount.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Expense Breakdown */}
              <div className="space-y-3">
                <h4 className="font-extrabold text-lg tracking-tight px-1">Expense Breakdown</h4>
                <div className="bg-white/50 border border-gray-100 shadow-sm p-5 rounded-[32px] space-y-4">
                  {expenseBreakdown.length === 0 ? (
                     <p className="text-sm text-gray-400 text-center py-2">No expenses tracked this month.</p>
                  ) : (
                    expenseBreakdown.map((item, idx) => {
                      const percentage = (item.amount / stats.totalExpenses) * 100;
                      return (
                        <div key={idx} className="space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-widest leading-none">
                            <span className="text-gray-500 flex items-center gap-2">
                              <span>{item.icon}</span>
                              {item.name}
                            </span>
                            <span className="text-black">RM {item.amount.toFixed(2)}</span>
                          </div>
                          <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className={`h-full ${item.color} rounded-full`}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'Income' && (
            <motion.div 
              key="income"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">Transactions for {monthStr}</div>
              {currentMonthIncome.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-gray-400">No income records found.</p>
                </div>
              ) : (
                currentMonthIncome.map(item => (
                  <div key={item.id} className="bg-white dark:bg-gray-900/50 p-4 rounded-2xl flex justify-between items-center shadow-sm border border-gray-50 dark:border-gray-800 group overflow-hidden relative">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center justify-center font-bold">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm">{item.note || item.source || 'General Income'}</p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-[10px] text-gray-400 font-medium">{format(parseISO(item.date), 'MMM dd, yyyy')}</p>
                          {item.isSalary && (
                             <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Salary</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-base font-bold text-green-600 tracking-tight group-hover:translate-x-[-10px] transition-transform">+RM {item.amount.toFixed(2)}</div>
                      <button 
                        onClick={() => deleteEntry('income', item.id)}
                        className="absolute right-[-40px] group-hover:right-2 p-2 text-red-500 transition-all bg-white dark:bg-gray-900 rounded-full shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeView === 'Expenses' && (
            <motion.div 
              key="expenses"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">Spending for {monthStr}</div>
              {currentMonthExpenses.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-gray-400">No tracked expenses.</p>
                </div>
              ) : (
                currentMonthExpenses.map(item => {
                  const cat = categories.find(c => c.id === item.categoryId);
                  return (
                    <div key={item.id} className="bg-white dark:bg-gray-900/50 p-4 rounded-2xl flex justify-between items-center shadow-sm border border-gray-50 dark:border-gray-800 group overflow-hidden relative">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl shadow-inner">
                          {cat?.icon || '📦'}
                        </div>
                      <div>
                        <p className="font-bold text-sm">{item.note || item.merchant || cat?.name || 'Expense'}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <p className="text-[10px] text-gray-400 font-medium">{format(parseISO(item.date), 'MMM dd, yyyy')}</p>
                          {item.paymentMethod && (
                             <>
                               <span className="w-0.5 h-0.5 bg-gray-200 rounded-full"></span>
                               <p className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">{item.paymentMethod}</p>
                             </>
                          )}
                          {cat?.budget && (
                            <>
                              <span className="w-0.5 h-0.5 bg-gray-200 rounded-full"></span>
                              <p className="text-[10px] text-blue-600 font-bold uppercase tracking-tighter">Budget: RM {cat.budget}</p>
                            </>
                          )}
                        </div>
                      </div>
                      </div>
                      <div className="flex items-center gap-2 transition-all">
                        <div className="text-base font-bold tracking-tight">RM {item.amount.toFixed(2)}</div>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={() => handleAddData('Expenses', { ...item, id: undefined, date: new Date().toISOString() })}
                            className="p-2 text-gray-400 hover:text-blue-500"
                            title="Duplicate"
                          >
                            <Copy size={16} />
                          </button>
                          {item.receiptId ? (
                            <button onClick={() => setViewingReceipt(item.receiptId!)} className="p-2 text-blue-600">
                              <ImageIcon size={16} />
                            </button>
                          ) : (
                            <label className="p-2 text-gray-300 cursor-pointer hover:text-blue-500">
                              <Plus size={16} />
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => handleReceiptUpload(e, item.id, 'expense')} />
                            </label>
                          )}
                          <button onClick={() => deleteEntry('expenses', item.id)} className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </motion.div>
          )}

          {activeView === 'Commitments' && (
            <motion.div 
              key="commitments"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div className="text-sm font-semibold text-gray-400 uppercase tracking-widest px-1 mb-2">Monthly Fixed Costs</div>
              {commitments.length === 0 ? (
                <div className="text-center py-20 bg-white/50 dark:bg-gray-900/30 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-gray-400">Setup your recurring bills.</p>
                </div>
              ) : (
                commitments.map(item => (
                  <div key={item.id} className="bg-white dark:bg-gray-900/50 p-4 rounded-2xl flex justify-between items-center border border-gray-50 dark:border-gray-800 shadow-sm relative overflow-hidden group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                        {item.dueDateDay}
                      </div>
                      <div>
                        <p className="font-bold">{item.title}</p>
                        <p className="text-xs text-gray-400">Day {item.dueDateDay} monthly • RM {item.amount.toFixed(2)}</p>
                      </div>
                    </div>
                    <button 
                      onClick={async () => {
                        await remove('commitments', item.id);
                        setCommitments(prev => prev.filter(c => c.id !== item.id));
                      }}
                      className="p-2 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          )}

          {activeView === 'Goals' && (
            <motion.div 
              key="goals"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Savings Goals</h3>
              </div>
              
              {goals.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200">
                  <p className="text-gray-400">No savings goals yet.</p>
                </div>
              ) : (
                goals.map(goal => {
                  const percentage = Math.min(100, (goal.currentAmount / goal.targetAmount) * 100);
                  return (
                    <Card key={goal.id} className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center bg-gray-50 text-gray-900 border border-gray-100`}>
                            <Target size={20} />
                          </div>
                          <div>
                            <p className="font-bold">{goal.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">RM {goal.targetAmount.toFixed(2)} Target</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-blue-600">RM {goal.currentAmount.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{Math.round(percentage)}% Complete</p>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            className="h-full bg-blue-600 rounded-full shadow-sm"
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <button 
                            onClick={async () => {
                              const amount = prompt("Contribution amount (RM):");
                              if (!amount) return;
                              const val = parseFloat(amount);
                              if (isNaN(val)) return;
                              
                              const updatedGoal = { ...goal, currentAmount: goal.currentAmount + val };
                              await update('goals', updatedGoal);
                              setGoals(prev => prev.map(g => g.id === goal.id ? updatedGoal : g));
                              
                              const contribution: GoalContribution = {
                                id: crypto.randomUUID(),
                                goalId: goal.id,
                                amount: val,
                                date: new Date().toISOString(),
                                monthYear: monthYearKey
                              };
                              await add('goalContributions', contribution);
                              setGoalContributions(prev => [...prev, contribution]);
                            }}
                            className="text-[11px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                          >
                            Add Contribution
                          </button>
                          <button 
                            onClick={async () => {
                              if (!confirm("Delete this goal?")) return;
                              await remove('goals', goal.id);
                              setGoals(prev => prev.filter(g => g.id !== goal.id));
                            }}
                            className="p-1.5 text-red-500 opacity-30 hover:opacity-100"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })
              )}
            </motion.div>
          )}

          {activeView === 'Budgets' && (
            <motion.div 
              key="budgets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Monthly Budgets</h3>
              </div>
              <div className="space-y-4">
                {categories.filter(c => c.type === 'expense').map(cat => {
                  const spent = currentMonthExpenses.filter(e => e.categoryId === cat.id).reduce((a, b) => a + b.amount, 0);
                  const limit = cat.budget || 0;
                  const remaining = limit - spent;
                  const percentage = limit > 0 ? (spent / limit) * 100 : 0;
                  
                  let colorClass = "bg-blue-600";
                  if (percentage > 100) colorClass = "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.4)]";
                  else if (percentage > 90) colorClass = "bg-red-500";
                  else if (percentage > 70) colorClass = "bg-orange-500";

                  return (
                    <Card key={cat.id} className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{cat.icon}</div>
                          <div>
                            <p className="font-bold">{cat.name}</p>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                               {limit > 0 ? `RM ${limit.toFixed(2)} Limit` : 'No Limit Set'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-black ${percentage > 100 ? 'text-red-600' : 'text-black'}`}>RM {spent.toFixed(2)}</p>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{limit > 0 ? `${Math.round(percentage)}% used` : 'N/A'}</p>
                        </div>
                      </div>
                      
                      {limit > 0 && (
                        <>
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(100, percentage)}%` }}
                              className={`h-full ${colorClass} transition-colors`}
                            />
                          </div>
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                            <span className={remaining < 0 ? 'text-red-500' : 'text-gray-400'}>
                              {remaining < 0 ? 'Over Budget' : 'Remaining'}
                            </span>
                            <span className={remaining < 0 ? 'text-red-600' : 'text-green-600'}>
                              RM {Math.abs(remaining).toFixed(2)}
                            </span>
                          </div>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeView === 'Debts' && (
            <motion.div 
              key="debts"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Active Debts</h3>
                <button onClick={() => setShowAddModal('Debts')} className="text-blue-600 text-[10px] font-bold uppercase tracking-widest">Add Debt</button>
              </div>

              {debts.length === 0 ? (
                 <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200">
                    <p className="text-gray-400">No active debts tracked.</p>
                 </div>
              ) : (
                debts.map(debt => {
                  const percentage = ((debt.originalAmount - debt.remainingAmount) / debt.originalAmount) * 100;
                  return (
                    <Card key={debt.id} className="space-y-4">
                       <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-lg">{debt.name}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Lender: {debt.lender}</p>
                          </div>
                          <div className="text-right">
                             <p className="text-red-600 font-black">RM {debt.remainingAmount.toFixed(2)}</p>
                             <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Remaining of RM {debt.originalAmount.toFixed(2)}</p>
                          </div>
                       </div>
                       
                       <div className="space-y-2">
                          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${percentage}%` }}
                               className="h-full bg-green-500"
                             />
                          </div>
                          <div className="flex justify-between items-center pb-2">
                             <span className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Monthly: RM {debt.monthlyPayment.toFixed(2)}</span>
                             <span className="text-[11px] font-bold text-green-600 uppercase tracking-widest">{Math.round(percentage)}% Paid</span>
                          </div>
                          <div className="flex gap-2">
                             <button 
                                onClick={async () => {
                                  const amount = prompt("Payment amount (RM):");
                                  if (!amount) return;
                                  const val = parseFloat(amount);
                                  if (isNaN(val)) return;
                                  
                                  const updatedDebt = { ...debt, remainingAmount: Math.max(0, debt.remainingAmount - val) };
                                  await update('debts', updatedDebt);
                                  setDebts(prev => prev.map(d => d.id === debt.id ? updatedDebt : d));
                                  
                                  const payment: DebtPayment = {
                                    id: crypto.randomUUID(),
                                    debtId: debt.id,
                                    amount: val,
                                    date: new Date().toISOString()
                                  };
                                  await add('debtPayments', payment);
                                  setDebtPayments(prev => [...prev, payment]);
                                }}
                                className="flex-1 h-10 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
                             >
                               Record Payment
                             </button>
                             <button 
                                onClick={async () => {
                                  if (!confirm("Remove this debt?")) return;
                                  await remove('debts', debt.id);
                                  setDebts(prev => prev.filter(d => d.id !== debt.id));
                                }}
                                className="w-10 h-10 bg-red-50 text-red-500 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                    </Card>
                  );
                })
              )}
            </motion.div>
          )}

          {activeView === 'Reports' && (
            <motion.div 
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center px-1">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Financial Insights</h3>
                <button onClick={closeMonth} className="text-blue-600 text-[10px] font-bold uppercase tracking-widest bg-blue-50 px-3 py-1.5 rounded-lg active:scale-95">Archive Month</button>
              </div>

              <Card className="p-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Income vs Expenses</h4>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[
                      { name: 'Income', amount: stats.totalIncome, color: '#10b981' },
                      { name: 'Expenses', amount: stats.totalExpenses, color: '#ef4444' },
                      { name: 'Bills', amount: stats.paidCommitments, color: '#3b82f6' }
                    ]}>
                      <XAxis dataKey="name" fontSize={10} fontWeight="bold" axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                        {[0, 1, 2].map((_, i) => (
                           <Cell key={i} fill={['#10b981', '#ef4444', '#3b82f6'][i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-6 px-1">Spending Categories</h4>
                <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                     <RePieChart>
                       <Pie 
                         data={expenseBreakdown} 
                         dataKey="amount" 
                         nameKey="name" 
                         cx="50%" 
                         cy="50%" 
                         innerRadius={60} 
                         outerRadius={80} 
                         paddingAngle={5}
                       >
                         {expenseBreakdown.map((item, idx) => (
                            <Cell key={idx} fill={['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5]} />
                         ))}
                       </Pie>
                       <Tooltip />
                     </RePieChart>
                   </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-y-3 mt-4">
                   {expenseBreakdown.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][idx % 5] }}></div>
                         <span className="text-[10px] font-bold text-gray-500 uppercase truncate">{item.name}</span>
                      </div>
                   ))}
                </div>
              </Card>

              <div className="space-y-3">
                 <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Monthly Snapshots</h4>
                 {snapshots.length === 0 ? (
                    <Card className="text-center py-6 text-gray-400 text-sm">No archived snapshots.</Card>
                 ) : (
                    snapshots.map(s => (
                      <Card key={s.id} className="flex justify-between items-center">
                         <div>
                            <p className="font-bold">{format(parseISO(s.id + '-01'), 'MMMM yyyy')}</p>
                            <p className="text-[10px] text-gray-400 font-bold uppercase">RM {s.totals.balance.toFixed(2)} Saved</p>
                         </div>
                         <div className="text-right">
                            <p className="text-sm font-black text-blue-600">RM {s.totals.income.toFixed(2)}</p>
                         </div>
                      </Card>
                    ))
                 )}
              </div>
            </motion.div>
          )}
          {activeView === 'Settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Categories</h3>
                  <button onClick={() => setShowCategoryModal(true)} className="text-blue-600 text-[10px] font-bold uppercase tracking-wider">Add New</button>
                </div>
                <Card className="divide-y divide-gray-50 dark:divide-gray-800 p-0 overflow-hidden">
                  {categories.map(c => (
                    <div key={c.id} className="flex justify-between items-center p-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{c.icon}</span>
                        <span className="font-medium text-sm">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number"
                          placeholder="Budget"
                          defaultValue={c.budget}
                          onBlur={async (e) => {
                            const val = parseFloat(e.target.value);
                            const updated = { ...c, budget: isNaN(val) ? undefined : val };
                            await update('categories', updated);
                            setCategories(prev => prev.map(cat => cat.id === c.id ? updated : cat));
                          }}
                          className="w-20 h-8 bg-gray-50 text-[10px] font-bold border border-gray-100 rounded-lg px-2 focus:ring-1 focus:ring-blue-600 outline-none"
                        />
                        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full uppercase font-bold text-gray-400">{c.type}</span>
                        <button onClick={() => {
                          remove('categories', c.id);
                          setCategories(prev => prev.filter(cat => cat.id !== c.id));
                        }} className="p-1 text-red-500 opacity-30 hover:opacity-100"><X size={14}/></button>
                      </div>
                    </div>
                  ))}
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Savings Target</h3>
                <Card className="flex justify-between items-center bg-blue-50/50 border-blue-100">
                  <div className="flex-1">
                    <p className="font-semibold text-sm">Monthly Goal</p>
                    <p className="text-[11px] text-gray-500">Amount to protect from "Safe to Spend".</p>
                  </div>
                  <input 
                    type="number" 
                    value={savingsTarget} 
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setSavingsTarget(isNaN(val) ? 0 : val);
                    }}
                    className="w-24 h-10 bg-white border border-blue-200 rounded-xl px-3 font-bold text-sm text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                  />
                </Card>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Data Management</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={async () => {
                      const data: any = {};
                      const stores = ['categories', 'income', 'expenses', 'commitments', 'commitmentLogs', 'receipts', 'goals', 'goalContributions', 'budgets', 'debts', 'debtPayments', 'monthlySnapshots'];
                      for (const s of stores) {
                        data[s] = await getAll(s);
                      }
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `flowtrack_backup_${format(new Date(), 'yyyy-MM-dd')}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                    }}
                    className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 active:scale-95 transition-all"
                  >
                    <Download className="text-blue-600" size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-center">Export Backup</span>
                  </button>
                  <label className="flex flex-col items-center justify-center gap-3 bg-white p-6 rounded-[24px] shadow-sm border border-gray-100 active:scale-95 transition-all cursor-pointer text-center">
                    <Upload className="text-blue-600" size={24} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Import Backup</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept=".json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const text = await file.text();
                        try {
                          const data = JSON.parse(text);
                          const stores = Object.keys(data);
                          for (const s of stores) {
                            for (const item of data[s]) {
                              await update(s, item);
                            }
                          }
                          alert("Import successful! Reloading...");
                          window.location.reload();
                        } catch (err) {
                          alert("Import failed: " + err);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">Storage</h3>
                <Card className="flex justify-between items-center bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30">
                  <div>
                    <p className="font-semibold text-sm">Offline Storage</p>
                    <p className="text-[11px] text-gray-500">IndexedDB is active. Your data is private and local.</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <CheckSquare size={18} />
                  </div>
                </Card>
              </div>

              <div className="p-8 text-center">
                <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em]">FlowTrack v1.0.0</p>
                <p className="text-[10px] text-gray-400 font-medium">Built for Apple UI Standards</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
        {/* OCR Result Overlay */}
        <AnimatePresence>
          {ocrResult && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            >
              <div className="bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl space-y-6">
                <div className="flex justify-between items-center">
                  <div className="space-y-0.5">
                    <h2 className="text-2xl font-black tracking-tight text-gray-900">Found Receipt!</h2>
                    <div className="flex items-center gap-1.5 pt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${ocrResult.confidence > 80 ? 'bg-green-500' : ocrResult.confidence > 60 ? 'bg-amber-500' : 'bg-red-500'} animate-pulse`} />
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                        AI Confidence: {Math.round(ocrResult.confidence || 0)}%
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setOcrResult(null)} className="p-2 bg-gray-50 rounded-full text-gray-400 hover:text-black">
                     <X size={20} />
                  </button>
                </div>

                {ocrResult.confidence < 70 && (
                  <div className="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex gap-3">
                    <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-amber-800 font-medium leading-relaxed">
                      AI is unsure about some data. Please double-check the merchant and amount before saving.
                    </p>
                  </div>
                )}
                
                <div className="space-y-4">
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Merchant</p>
                     <input 
                        type="text" 
                        value={ocrResult.merchant} 
                        onChange={(e) => setOcrResult({ ...ocrResult, merchant: e.target.value })}
                        className="w-full h-12 bg-gray-100 rounded-2xl px-5 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Amount (RM)</p>
                      <input 
                          type="number" 
                          step="0.01"
                          value={ocrResult.amount} 
                          onChange={(e) => setOcrResult({ ...ocrResult, amount: parseFloat(e.target.value) })}
                          className="w-full h-12 bg-gray-100 rounded-2xl px-5 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Date</p>
                      <input 
                          type="date" 
                          value={ocrResult.date} 
                          onChange={(e) => setOcrResult({ ...ocrResult, date: e.target.value })}
                          className="w-full h-12 bg-gray-100 rounded-2xl px-5 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Category</p>
                    <select 
                      value={ocrResult.categoryId || categories.find(c => c.type === 'expense')?.id || ''} 
                      onChange={(e) => setOcrResult({ ...ocrResult, categoryId: e.target.value })}
                      className="w-full h-12 bg-gray-100 rounded-2xl px-5 font-bold outline-none focus:ring-2 focus:ring-blue-600 transition-all appearance-none"
                    >
                      {categories.filter(c => c.type === 'expense').map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    onClick={() => setOcrResult(null)}
                    className="flex-1 h-14 bg-gray-100 text-gray-500 font-bold rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      const data = {
                        amount: ocrResult.amount,
                        date: ocrResult.date,
                        note: ocrResult.merchant,
                        categoryId: ocrResult.categoryId || categories.find(c => c.type === 'expense')?.id || categories[0].id,
                        merchant: ocrResult.merchant,
                        paymentMethod: 'OCR Scan'
                      };
                      await handleAddData('Expenses', data);
                      setOcrResult(null);
                    }}
                    className="flex-1 h-14 bg-blue-600 text-white font-bold rounded-2xl active:scale-95 transition-all text-sm uppercase tracking-widest shadow-xl shadow-blue-600/20"
                  >
                    Save Expense
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {isScanning && (
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center"
             >
                <div className="text-center space-y-4">
                   <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                   <p className="text-white font-black tracking-widest uppercase animate-pulse">Scanning Receipt...</p>
                </div>
             </motion.div>
          )}
        </AnimatePresence>

      <BottomNav activeView={activeView} setView={setActiveView} />

      {/* Receipt Viewer Modal */}
      <AnimatePresence>
        {viewingReceipt && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingReceipt(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-sm rounded-[32px] overflow-hidden bg-white shadow-2xl"
            >
              {receipts.find(r => r.id === viewingReceipt) && (
                <img 
                  src={receipts.find(r => r.id === viewingReceipt)?.data} 
                  alt="Receipt" 
                  className="w-full h-auto object-contain max-h-[70vh]" 
                />
              )}
              <div className="p-6 flex justify-between items-center bg-white dark:bg-gray-900">
                <p className="font-bold text-sm truncate pr-4">{receipts.find(r => r.id === viewingReceipt)?.name}</p>
                <button 
                  onClick={() => setViewingReceipt(null)}
                  className="px-6 h-12 bg-gray-100 dark:bg-gray-800 rounded-2xl font-bold active:scale-95 transition-all text-sm"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-[110] flex items-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="relative w-full bg-white dark:bg-gray-900 rounded-t-[32px] p-8 pb-12 shadow-2xl safe-bottom border-t border-white/20"
            >
              <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-6 tracking-tight">New Category</h2>
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                handleAddCategory(
                  formData.get('name') as string,
                  formData.get('icon') as string,
                  formData.get('type') as any
                );
                setShowCategoryModal(false);
              }} className="space-y-4">
                <input name="name" placeholder="Category Name" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                <input name="icon" placeholder="Emoji Icon" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                <select name="type" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold appearance-none">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="commitment">Commitment</option>
                </select>
                <button type="submit" className="w-full h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-transform mt-4">
                  Create Category
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-end">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full bg-white dark:bg-gray-900 rounded-t-[32px] p-8 pb-12 shadow-2xl safe-bottom border-t border-white/20"
            >
              <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 rounded-full mx-auto mb-6" />
              <h2 className="text-2xl font-black mb-6 tracking-tight">Add {showAddModal}</h2>
              
              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const data: any = {
                  amount: parseFloat(formData.get('amount') as string),
                  date: formData.get('date') ? new Date(formData.get('date') as string).toISOString() : new Date().toISOString(),
                  note: formData.get('note'),
                };
                if (showAddModal === 'Income') {
                  data.categoryId = formData.get('category') as string;
                  data.isSalary = formData.get('isSalary') === 'true';
                  data.monthKey = formData.get('monthKey') || monthYearKey;
                  data.source = formData.get('source');
                } else if (showAddModal === 'Expenses') {
                  data.categoryId = formData.get('category');
                  data.merchant = formData.get('merchant');
                  data.paymentMethod = formData.get('paymentMethod');
                } else if (showAddModal === 'Commitments') {
                  data.title = formData.get('title');
                  data.dueDateDay = parseInt(formData.get('day') as string);
                  data.categoryId = categories.find(c => c.type === 'commitment')?.id;
                  data.paymentMethod = formData.get('paymentMethod');
                  data.frequency = formData.get('frequency') || 'monthly';
                } else if (showAddModal === 'Goals') {
                  const goal: Goal = {
                    id: crypto.randomUUID(),
                    name: formData.get('name') as string,
                    targetAmount: parseFloat(formData.get('target') as string),
                    currentAmount: parseFloat(formData.get('current') as string) || 0,
                  };
                  await add('goals', goal);
                  setGoals(prev => [...prev, goal]);
                  setShowAddModal(null);
                  return;
                } else if (showAddModal === 'Debts') {
                  const debt: Debt = {
                    id: crypto.randomUUID(),
                    name: formData.get('name') as string,
                    lender: formData.get('lender') as string,
                    originalAmount: parseFloat(formData.get('original') as string),
                    remainingAmount: parseFloat(formData.get('remaining') as string),
                    monthlyPayment: parseFloat(formData.get('monthly') as string),
                    dueDay: parseInt(formData.get('day') as string),
                    startDate: new Date().toISOString()
                  };
                  await add('debts', debt);
                  setDebts(prev => [...prev, debt]);
                  setShowAddModal(null);
                  return;
                }
                handleAddData(showAddModal, data);
              }} className="space-y-4">
                
                {showAddModal === 'Commitments' && (
                  <>
                    <input name="title" placeholder="Title (e.g. Rent)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="amount" type="number" step="0.01" placeholder="Amount (RM)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <div className="grid grid-cols-2 gap-4">
                      <input name="day" type="number" min="1" max="31" placeholder="Due Day (1-31)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                      <select name="frequency" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold appearance-none">
                        <option value="monthly">Monthly</option>
                        <option value="weekly">Weekly</option>
                        <option value="yearly">Yearly</option>
                      </select>
                    </div>
                    <input name="paymentMethod" placeholder="Payment Method (e.g. Bank Transfer)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                  </>
                )}

                {showAddModal === 'Goals' && (
                  <>
                    <input name="name" placeholder="Goal Name (e.g. iPhone)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="target" type="number" step="0.01" placeholder="Target Amount (RM)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="current" type="number" step="0.01" placeholder="Current Savings (Optional)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                  </>
                )}

                {showAddModal === 'Debts' && (
                  <>
                    <input name="name" placeholder="Debt Name (e.g. Student Loan)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="lender" placeholder="Lender / Bank" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="original" type="number" step="0.01" placeholder="Total Debt Amount (RM)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="remaining" type="number" step="0.01" placeholder="Remaining Amount (RM)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="monthly" type="number" step="0.01" placeholder="Monthly Payment (RM)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                    <input name="day" type="number" placeholder="Due Day of Month (1-31)" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                  </>
                )}

                {(showAddModal === 'Income' || showAddModal === 'Expenses') && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Amount (RM)</p>
                        <input name="amount" type="number" step="0.01" placeholder="0.00" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" required />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Date</p>
                        <input name="date" type="date" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
                      </div>
                    </div>
                    {showAddModal === 'Income' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Category</p>
                            <select name="category" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold appearance-none" required>
                              {categories.filter(c => c.type === 'income').map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Income Type</p>
                            <select name="isSalary" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold appearance-none">
                              <option value="false">Extra Income</option>
                              <option value="true">Fixed Salary</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Source</p>
                          <input name="source" placeholder="Employer/Bank" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Note</p>
                          <input name="note" placeholder="What's this for?" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                        </div>
                      </div>
                    )}
                    {showAddModal === 'Expenses' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Category</p>
                            <select name="category" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold appearance-none" required>
                              <option value="">Select</option>
                              {categories.filter(c => c.type === 'expense').map(c => (
                                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Method</p>
                            <input name="paymentMethod" placeholder="Cash/Card" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Merchant</p>
                          <input name="merchant" placeholder="Where did you spend?" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Note</p>
                          <input name="note" placeholder="Optional details" className="w-full h-14 bg-gray-100 dark:bg-gray-800 rounded-2xl px-6 font-bold" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button type="submit" className="w-full h-16 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-transform mt-4">
                  Save {showAddModal}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
