'use client';
import React, { useState, useTransition, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Bot, Users, PlusCircle, MessageSquare, Home, Users2, DollarSign, Settings, MoreHorizontal, Trash, Edit, CalendarIcon, CreditCard, Banknote, User, Eye, Phone, Mail, FileText, BadgeCheck, BadgeX, ShoppingCart, Wallet, ChevronUp, ChevronDown, Repeat, AlertTriangle, ArrowUpDown, Clock, Search, XIcon, ShieldAlert, Copy, LifeBuoy, CheckCircle, Flame, ClipboardList, Check, LogOut, Send } from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import ZapConnectCard, { type ConnectionStatus } from './zap-connect-card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from "@/components/ui/table"
import { Textarea } from './ui/textarea';
import { sendMessage, getStatus, sendToGroupWebhook, sendGroupMessage } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Loader } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from './ui/dropdown-menu';
import { addDays, addMonths, format, isFuture, differenceInDays, startOfDay, subDays, isToday, startOfMonth, endOfMonth, startOfYear, endOfYear, isWithinInterval, endOfDay, setHours, setMinutes, setSeconds, getHours, getMinutes, isPast } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { useFirestore, useCollection, addDoc, updateDoc, deleteDoc, useMemoFirebase } from '@/firebase';
import { collection, Timestamp, doc, writeBatch, query, orderBy } from 'firebase/firestore';
import { Switch } from './ui/switch';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
  } from "@/components/ui/collapsible"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useSecurity } from './security-provider';


export type ClientStatus = 'ativo' | 'vencido' | 'cancelado';

export type Client = {
    id: string;
    name: string;
    phone: string;
    emails: string[];
    notes: string;
    subscription: string;
    status: ClientStatus; // Now dynamic
    dueDate: Date | Timestamp | null;
    createdAt: Date | Timestamp;
    paymentMethod: 'pix' | 'cartao' | 'boleto' | null;
    amountPaid: number | null;
    isResale: boolean;
    quantity: number;
    lastNotificationSent?: Date | Timestamp | null;
    lastReminderSent?: Date | Timestamp | null;
    lastRemarketingPostDueDateSent?: Date | Timestamp | null;
    lastRemarketingPostRegistrationSent?: Date | Timestamp | null;
    isSupport?: boolean;
    supportEmails?: string[];
};

type Subscription = {
    id: string;
    name: string;
    price: number;
};

type AutomationConfig = {
    id: string;
    isEnabled: boolean;
    message: string;
    reminderIsEnabled: boolean;
    reminderMessage: string;
    remarketingPostDueDateDays: number;
    remarketingPostDueDateMessage: string;
    remarketingPostDueDateIsEnabled: boolean;
    remarketingPostRegistrationDays: number;
    remarketingPostRegistrationMessage: string;
    remarketingPostRegistrationIsEnabled: boolean;
}

type Note = {
    id: string;
    content: string;
    status: 'todo' | 'done';
    createdAt: Timestamp;
}

const getInitialState = (): { status: ConnectionStatus, profileName: string | null, profilePic: string | null } => {
    if (typeof window === 'undefined') {
        return { status: 'loading', profileName: null, profilePic: null };
    }
    try {
        const storedStatus = localStorage.getItem('zap_connection_status') as ConnectionStatus | null;
        if (storedStatus === 'connected') {
            const profileName = localStorage.getItem('zap_profile_name');
            const profilePic = localStorage.getItem('zap_profile_pic');
            return { status: 'connected', profileName, profilePic };
        }
        return { status: 'loading', profileName: null, profilePic: null };
    } catch (error) {
        console.error("Error reading from localStorage", error);
        return { status: 'loading', profileName: null, profilePic: null };
    }
};


const getClientStatus = (dueDate: Date | Timestamp | null): ClientStatus => {
    if (!dueDate) {
      return 'ativo'; // No due date means always active
    }
    const today = startOfDay(new Date());
    const date = dueDate instanceof Timestamp ? dueDate.toDate() : dueDate;
  
    // If due date is today or in the future, they are active.
    if (startOfDay(date) >= today) {
      return 'ativo';
    }
    
    // It's past due. Check if it's "vencido" or "cancelado".
    // "vencido" is for up to 5 days past due. "cancelado" is for more than 5 days.
    const fiveDaysAgo = subDays(today, 5);
    
    if (date < today && date >= fiveDaysAgo) {
      return 'vencido';
    }

    // Due date is more than 5 days ago
    return 'cancelado';
};

const AppDashboard = () => {
    const pathname = usePathname();
    const firestore = useFirestore();
    const { logout } = useSecurity();

    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const initialState = getInitialState();
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(initialState.status);
    const [zapProfile, setZapProfile] = useState<{name: string | null, pic: string | null}>({ name: initialState.profileName, pic: initialState.profilePic });
    
    const [isTransitioningPage, startTransition] = useTransition();
    const { toast } = useToast();

    const messagingPaths = ['/automacao', '/automacao/remarketing', '/automacao/grupos'];
    const clientPaths = ['/clientes', '/clientes/suporte'];
    const [isMessagingMenuOpen, setIsMessagingMenuOpen] = useState(messagingPaths.some(p => pathname.startsWith(p)));
    const [isClientMenuOpen, setIsClientMenuOpen] = useState(clientPaths.some(p => pathname.startsWith(p)));

    useEffect(() => {
        const isCurrentPathInMessaging = messagingPaths.some(p => pathname.startsWith(p));
        if (!isCurrentPathInMessaging) {
            setIsMessagingMenuOpen(false);
        }
        const isCurrentPathInClients = clientPaths.some(p => pathname.startsWith(p));
        if(!isCurrentPathInClients) {
            setIsClientMenuOpen(false)
        }
    }, [pathname]);

    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                if (connectionStatus === 'connected') {
                    localStorage.setItem('zap_connection_status', connectionStatus);
                    if (zapProfile.name) localStorage.setItem('zap_profile_name', zapProfile.name);
                    if (zapProfile.pic) localStorage.setItem('zap_profile_pic', zapProfile.pic);
                } else if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
                    localStorage.removeItem('zap_connection_status');
                    localStorage.removeItem('zap_profile_name');
                    localStorage.removeItem('zap_profile_pic');
                }
            }
        } catch (error) {
            console.error("Error writing to localStorage", error);
        }
    }, [connectionStatus, zapProfile]);

    useEffect(() => {
        let isCancelled = false;
    
        const fetchStatus = async () => {    
          try {
            const result = await getStatus();
            if (isCancelled) return;
            if (result.error) throw new Error(result.error);
            
            const newStatus = result.status as ConnectionStatus;
            
            if (newStatus && ["disconnected", "connecting", "connected"].includes(newStatus)) {
              setConnectionStatus(newStatus);
              if (newStatus === "connected") {
                setZapProfile({
                    name: result.nomeperfil || null,
                    pic: result.fotoperfil || null,
                });
              } else {
                setZapProfile({ name: null, pic: null });
              }
            } else if (connectionStatus === 'loading') { // Only transition from loading to disconnected
              setConnectionStatus('disconnected');
            }
          } catch (error) {
            if (isCancelled) return;
            console.error("Error fetching status:", error);
            // Don't toast on initial load error, but set state to error
            if (connectionStatus !== 'loading') {
                toast({
                    variant: "destructive",
                    title: "Status Check Failed",
                    description: error instanceof Error ? error.message : "Could not retrieve connection status.",
                });
            }
            setConnectionStatus("error");
          }
        };
    
        const intervalId = setInterval(fetchStatus, 10000);
        fetchStatus(); // Initial fetch
    
        return () => {
          isCancelled = true;
          clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []); // Run only once on mount

    const subscriptionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users', hardcodedUserId, 'subscriptions') : null, [firestore, hardcodedUserId]);
    const { data: subscriptions, isLoading: subscriptionsLoading } = useCollection<Subscription>(subscriptionsQuery);

    const clientsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users', hardcodedUserId, 'clients') : null, [firestore, hardcodedUserId]);
    const { data: clients, isLoading: clientsLoading } = useCollection<Client>(clientsQuery);
    
    const automationConfigQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users', hardcodedUserId, 'automation') : null, [firestore, hardcodedUserId]);
    const { data: automationConfig, isLoading: automationLoading } = useCollection<AutomationConfig>(automationConfigQuery);
    const automationSettings = useMemo(() => automationConfig?.[0], [automationConfig]);

    const notesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users', hardcodedUserId, 'notes'), orderBy('createdAt', 'desc')) : null, [firestore, hardcodedUserId]);
    const { data: notes, isLoading: notesLoading } = useCollection<Note>(notesQuery);

    const [supportClient, setSupportClient] = useState<Client | null>(null);

    const transformedClients = React.useMemo(() => {
        return clients?.map(client => {
            const dueDate = client.dueDate instanceof Timestamp ? client.dueDate.toDate() : client.dueDate;
            return {
                ...client,
                dueDate: dueDate,
                status: getClientStatus(dueDate)
            };
        }) ?? [];
    }, [clients]);

    const supportClientsCount = useMemo(() => {
        return transformedClients.filter(c => c.isSupport).length;
    }, [transformedClients]);

    const formatMessage = useMemo(() => (message: string, client: Client) => {
        const clientDueDate = client.dueDate ? new Date(client.dueDate as Date) : null;
        return message
            .replace(/{cliente}/g, client.name)
            .replace(/{telefone}/g, client.phone)
            .replace(/{email}/g, client.emails[0] || '')
            .replace(/{assinatura}/g, client.subscription)
            .replace(/{vencimento}/g, clientDueDate ? format(clientDueDate, 'dd/MM/yyyy HH:mm') : 'N/A')
            .replace(/{valor}/g, client.amountPaid ? client.amountPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A')
            .replace(/{status}/g, client.status);
    }, []);

    const sendAutomationMessage = useMemo(() => (client: Client, message: string, type: 'due' | 'reminder' | 'remarketing-due' | 'remarketing-reg') => {
        if (!firestore) return;
    
        const formattedMessage = formatMessage(message, client);
    
        sendMessage(client.phone, formattedMessage)
            .then(result => {
                if (result.error) {
                    throw new Error(result.error);
                }
                
                const clientDoc = doc(firestore, 'users', hardcodedUserId, 'clients', client.id);
                let updateData = {};
                let toastTitle = '';
                let toastDescription = '';
    
                switch (type) {
                    case 'due':
                        updateData = { lastNotificationSent: Timestamp.now() };
                        toastTitle = 'Mensagem Automática Enviada';
                        toastDescription = `Mensagem de vencimento enviada para ${client.name}.`;
                        break;
                    case 'reminder':
                        updateData = { lastReminderSent: Timestamp.now() };
                        toastTitle = 'Lembrete Automático Enviado';
                        toastDescription = `Lembrete de vencimento enviado para ${client.name}.`;
                        break;
                    case 'remarketing-due':
                        updateData = { lastRemarketingPostDueDateSent: Timestamp.now() };
                        toastTitle = 'Remarketing Pós-Vencimento Enviado';
                        toastDescription = `Mensagem de remarketing enviada para ${client.name}.`;
                        break;
                    case 'remarketing-reg':
                        updateData = { lastRemarketingPostRegistrationSent: Timestamp.now() };
                        toastTitle = 'Remarketing Pós-Cadastro Enviado';
                        toastDescription = `Mensagem de remarketing enviada para ${client.name}.`;
                        break;
                }
                
                updateDoc(clientDoc, updateData);
    
                toast({
                    title: toastTitle,
                    description: toastDescription,
                });
            })
            .catch(error => {
                const toastTitle = `Falha no Envio (${type})`;
                toast({
                    variant: "destructive",
                    title: toastTitle,
                    description: `Não foi possível enviar a mensagem para ${client.name}: ${error.message}`,
                });
            });
    }, [firestore, toast, formatMessage, hardcodedUserId]);


    useEffect(() => {
        if (!automationSettings || !clients || !firestore) {
            return;
        }

        const checkInterval = setInterval(() => {
            const now = new Date();
            
            transformedClients.forEach(client => {
                
                // --- Due Date Logic ---
                if (automationSettings.isEnabled && client.dueDate) {
                    const dueDate = new Date(client.dueDate as Date);
                    const lastNotificationDate = client.lastNotificationSent instanceof Timestamp ? client.lastNotificationSent.toDate() : client.lastNotificationSent;
                    if (isPast(dueDate) && (!lastNotificationDate || lastNotificationDate < dueDate)) {
                        sendAutomationMessage(client, automationSettings.message, 'due');
                    }
                }

                // --- 3-Day Reminder Logic ---
                if (automationSettings.reminderIsEnabled && client.dueDate) {
                    const dueDate = new Date(client.dueDate as Date);
                    const reminderDate = subDays(dueDate, 3);
                    const lastReminderDate = client.lastReminderSent instanceof Timestamp ? client.lastReminderSent.toDate() : client.lastReminderSent;

                    if (isPast(reminderDate) && isFuture(dueDate) && (!lastReminderDate || lastReminderDate < reminderDate)) {
                         sendAutomationMessage(client, automationSettings.reminderMessage, 'reminder');
                    }
                }

                // --- Remarketing Post Due Date Logic ---
                if (automationSettings.remarketingPostDueDateIsEnabled && client.dueDate && automationSettings.remarketingPostDueDateDays > 0) {
                    const dueDate = new Date(client.dueDate as Date);
                    const remarketingDate = addDays(dueDate, automationSettings.remarketingPostDueDateDays);
                    const lastSentDate = client.lastRemarketingPostDueDateSent instanceof Timestamp ? client.lastRemarketingPostDueDateSent.toDate() : null;

                    if (isPast(remarketingDate) && (!lastSentDate || lastSentDate < remarketingDate)) {
                        sendAutomationMessage(client, automationSettings.remarketingPostDueDateMessage, 'remarketing-due');
                    }
                }

                // --- Remarketing Post Registration Logic ---
                if (automationSettings.remarketingPostRegistrationIsEnabled && client.createdAt && automationSettings.remarketingPostRegistrationDays > 0) {
                    const registrationDate = client.createdAt instanceof Timestamp ? client.createdAt.toDate() : new Date(client.createdAt);
                    const remarketingDate = addDays(registrationDate, automationSettings.remarketingPostRegistrationDays);
                    const lastSentDate = client.lastRemarketingPostRegistrationSent instanceof Timestamp ? client.lastRemarketingPostRegistrationSent.toDate() : null;

                    if (isPast(remarketingDate) && (!lastSentDate || lastSentDate < remarketingDate)) {
                        sendAutomationMessage(client, automationSettings.remarketingPostRegistrationMessage, 'remarketing-reg');
                    }
                }

            });
        }, 10000); // Check every 10 seconds

        return () => clearInterval(checkInterval);
    }, [automationSettings, clients, firestore, transformedClients, sendAutomationMessage]);

    const handleToggleSupport = useMemo(() => (client: Client) => {
        if (!firestore) return;
        
        if (client.isResale) {
            setSupportClient(client);
        } else {
            const clientDoc = doc(firestore, 'users', hardcodedUserId, 'clients', client.id);
            updateDoc(clientDoc, { isSupport: !client.isSupport, supportEmails: [] });
        }
    }, [firestore, hardcodedUserId]);
    
    const handleSaveSupportEmails = useMemo(() => (clientId: string, supportEmails: string[]) => {
        if (!firestore) return;
        const clientDoc = doc(firestore, 'users', hardcodedUserId, 'clients', clientId);
        updateDoc(clientDoc, { supportEmails: supportEmails, isSupport: supportEmails.length > 0 });
        setSupportClient(null);
    }, [firestore, hardcodedUserId]);


    const renderPage = () => {
        switch (pathname) {
            case '/':
                return <DashboardPage clients={transformedClients} rawClients={clients ?? []} />;
            case '/clientes':
                return <ClientsPage clients={transformedClients} subscriptions={subscriptions ?? []} onToggleSupport={handleToggleSupport} />;
            case '/clientes/suporte':
                return <SupportPage clients={transformedClients} onToggleSupport={handleToggleSupport} setSupportClient={setSupportClient} />;
            case '/notas':
                return <NotesPage notes={notes ?? []} />;
            case '/automacao':
                return <AutomationPage config={automationSettings} />;
            case '/automacao/remarketing':
                return <RemarketingPage config={automationSettings} />;
            case '/automacao/grupos':
                return <GroupsPage clients={transformedClients} />;
            case '/configuracoes':
                return <SettingsPage subscriptions={subscriptions ?? []} allClients={clients ?? []} />;
            default:
                return <DashboardPage clients={transformedClients} rawClients={clients ?? []} />;
        }
    };
    
    const isLoading = subscriptionsLoading || clientsLoading || automationLoading || notesLoading;

    if (isLoading && !isTransitioningPage) {
        return (
            <div className="flex h-full min-h-screen w-full items-center justify-center">
                <Loader className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }


  return (
    <div className="flex">
      <Sidebar>
        <SidebarHeader>
            <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary"><path d="M12.04 2.5a.5.5 0 0 1 .92 0l1.45 4.47a.5.5 0 0 0 .62.33l4.63-1.21a.5.5 0 0 1 .6.6l-1.2 4.63a.5.5 0 0 0 .33.62l4.47 1.45a.5.5 0 0 1 0 .92l-4.47 1.45a.5.5 0 0 0-.33.62l1.2 4.63a.5.5 0 0 1-.6.6l-4.63-1.2a.5.5 0 0 0-.62.33l-1.45 4.47a.5.5 0 0 1-.92 0l-1.45-4.47a.5.5 0 0 0-.62-.33l-4.63 1.2a.5.5 0 0 1-.6-.6l1.2-4.63a.5.5 0 0 0-.33-.62L2.5 12.46a.5.5 0 0 1 0-.92l4.47-1.45a.5.5 0 0 0 .33-.62L6.1 4.84a.5.5 0 0 1 .6-.6l4.63 1.2a.5.5 0 0 0 .62-.33z"/></svg>
                <h1 className="text-xl font-semibold">ZapConnect</h1>
            </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
                <Link href="/" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/'); }); }}>
                    <SidebarMenuButton isActive={pathname === '/'}>
                        <Home/> Início
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Collapsible open={isClientMenuOpen} onOpenChange={setIsClientMenuOpen}>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={pathname.startsWith('/clientes')} className="w-full justify-start">
                            <Users />
                            <span className="flex-1">Clientes</span>
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isClientMenuOpen && "rotate-180")} />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="pl-8 py-2 flex flex-col gap-2">
                             <Link href="/clientes" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/clientes'); }); }}>
                                <SidebarMenuButton variant="ghost" className="w-full justify-start" isActive={pathname === '/clientes'}>
                                    Todos os Clientes
                                </SidebarMenuButton>
                            </Link>
                            <Link href="/clientes/suporte" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/clientes/suporte'); }); }}>
                                <SidebarMenuButton variant="ghost" className="w-full justify-start" isActive={pathname === '/clientes/suporte'}>
                                    Suporte
                                    {supportClientsCount > 0 && (
                                        <Badge className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                                            {supportClientsCount}
                                        </Badge>
                                    )}
                                </SidebarMenuButton>
                            </Link>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarMenuItem>
            <SidebarMenuItem>
                 <Collapsible open={isMessagingMenuOpen} onOpenChange={setIsMessagingMenuOpen}>
                    <CollapsibleTrigger asChild>
                        <SidebarMenuButton isActive={pathname.startsWith('/automacao')} className="w-full justify-start">
                            <MessageSquare/>
                            <span className="flex-1">Envio de Mensagens</span>
                            <ChevronDown className={cn("h-4 w-4 transition-transform", isMessagingMenuOpen && "rotate-180")} />
                        </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="pl-8 py-2 flex flex-col gap-2">
                             <Link href="/automacao" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/automacao'); }); }}>
                                <SidebarMenuButton variant="ghost" className="w-full justify-start" isActive={pathname === '/automacao'}>
                                    <Bot/> Cobrança
                                </SidebarMenuButton>
                            </Link>
                            <Link href="/automacao/remarketing" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/automacao/remarketing'); }); }}>
                                <SidebarMenuButton variant="ghost" className="w-full justify-start" isActive={pathname === '/automacao/remarketing'}>
                                    <Flame/> Remarketing
                                </SidebarMenuButton>
                            </Link>
                            <Link href="/automacao/grupos" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/automacao/grupos'); }); }}>
                                <SidebarMenuButton variant="ghost" className="w-full justify-start" isActive={pathname === '/automacao/grupos'}>
                                    <Users2/> Grupos
                                </SidebarMenuButton>
                            </Link>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/notas" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/notas'); }); }}>
                    <SidebarMenuButton isActive={pathname === '/notas'}>
                        <ClipboardList/> Notas
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Dialog>
                    <DialogTrigger asChild>
                        <SidebarMenuButton>
                            <Bot/> Conexão
                            <span className={cn(
                                "absolute right-2 h-2 w-2 rounded-full",
                                connectionStatus === 'loading' ? 'bg-gray-400' :
                                connectionStatus === 'connected' ? 'bg-green-500 animate-color-pulse' : 'bg-red-500 animate-color-pulse'
                            )} />
                        </SidebarMenuButton>
                    </DialogTrigger>
                    <DialogContent className="p-0 max-w-md bg-background/80 backdrop-blur-sm border-none">
                        <ZapConnectCard
                            initialStatus={connectionStatus}
                            profileName={zapProfile.name}
                            profilePic={zapProfile.pic}
                            onStatusChange={(newStatus, newProfile) => {
                                setConnectionStatus(newStatus);
                                if (newProfile) {
                                    setZapProfile({ name: newProfile.name, pic: newProfile.pic });
                                }
                            }}
                        />
                    </DialogContent>
                </Dialog>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <Link href="/configuracoes" onClick={(e) => { e.preventDefault(); startTransition(() => { window.history.pushState(null, '', '/configuracoes'); }); }}>
                    <SidebarMenuButton isActive={pathname === '/configuracoes'}>
                        <Settings/> Configurações
                    </SidebarMenuButton>
                </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem>
                    <SidebarMenuButton onClick={logout}>
                        <LogOut /> Sair
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className={cn("flex min-h-screen w-full flex-col bg-background", isTransitioningPage && "opacity-50 transition-opacity")}>
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6 md:hidden">
            <h1 className="text-xl font-semibold text-center">ZapConnect</h1>
            <SidebarTrigger />
        </header>
        <main className='flex-1 p-4 sm:p-6 md:p-8'>
            {renderPage()}
        </main>
        {supportClient && (
            <MarkSupportDialog 
                client={supportClient}
                isOpen={!!supportClient}
                onOpenChange={(isOpen) => !isOpen && setSupportClient(null)}
                onSave={handleSaveSupportEmails}
            />
        )}
      </SidebarInset>
    </div>
  );
};

const DashboardPage = ({ clients, rawClients }: { clients: Client[], rawClients: Client[] }) => {
    const [salesInterval, setSalesInterval] = useState<'month' | 'today' | 'year' | 'custom'>('month');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const metrics = useMemo(() => {
        const totalClients = clients.length;
        const activeClientsList = clients.filter(c => c.status === 'ativo');
        const overdueClientsList = clients.filter(c => c.status === 'vencido' || c.status === 'cancelado');
        const dueTodayList = clients.filter(c => c.dueDate && isToday(new Date(c.dueDate as Date)));
        const dueIn3DaysList = clients.filter(c => {
            if (!c.dueDate) return false;
            const dueDate = startOfDay(new Date(c.dueDate as Date));
            const daysDiff = differenceInDays(dueDate, startOfDay(new Date()));
            return daysDiff > 0 && daysDiff <= 3;
        });

        const activeCount = activeClientsList.length;
        const overdueCount = overdueClientsList.length;
        const dueTodayCount = dueTodayList.length;
        const dueIn3DaysCount = dueIn3DaysList.length;

        const activeRevenue = activeClientsList.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
        const overdueRevenue = overdueClientsList.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
        const dueTodayRevenue = dueTodayList.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
        const dueIn3DaysRevenue = dueIn3DaysList.reduce((sum, c) => sum + (c.amountPaid || 0), 0);
        
        const activePercentage = totalClients > 0 ? (activeCount / totalClients) * 100 : 0;
        const overduePercentage = totalClients > 0 ? (overdueCount / totalClients) * 100 : 0;

        return {
            activeCount,
            activeRevenue,
            activePercentage,
            overdueCount,
            overdueRevenue,
            overduePercentage,
            dueTodayCount,
            dueTodayRevenue,
            dueIn3DaysCount,
            dueIn3DaysRevenue
        };
    }, [clients]);

    const handleIntervalChange = (value: 'today' | 'month' | 'year' | 'custom') => {
        const now = new Date();
        setSalesInterval(value);

        if (value === 'today') {
            setDateRange({ from: startOfDay(now), to: endOfDay(now) });
        } else if (value === 'month') {
            setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        } else if (value === 'year') {
            setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        }
    };
    
    const totalSales = useMemo(() => {
        if (!dateRange || !dateRange.from) return 0;
    
        const interval: Interval = {
            start: startOfDay(dateRange.from),
            end: dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from),
        };
    
        return rawClients
            .filter(client => {
                if (!client.amountPaid || !client.createdAt) return false;
                const createdAtDate = client.createdAt instanceof Timestamp ? client.createdAt.toDate() : new Date(client.createdAt);
                return isWithinInterval(createdAtDate, interval);
            })
            .reduce((total, client) => total + (client.amountPaid || 0), 0);
    
    }, [rawClients, dateRange]);
  
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold mb-6 text-center sm:text-left">Início</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <Card className="flex flex-col">
                <CardHeader className="bg-green-600/10 dark:bg-green-800/20 text-green-600 dark:text-green-400 flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 rounded-t-lg">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Users2 className="h-4 w-4" /> Ativos
                    </CardTitle>
                    <div className="text-sm font-semibold">{metrics.activePercentage.toFixed(1)}%</div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-between p-4">
                    <div className="text-2xl font-bold">{metrics.activeCount}</div>
                    <div className="text-right">
                        <p className="text-lg font-bold">{metrics.activeRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="flex flex-col">
                <CardHeader className="bg-red-600/10 dark:bg-red-800/20 text-red-500 dark:text-red-400 flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 rounded-t-lg">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" /> Vencidos
                    </CardTitle>
                    <div className="text-sm font-semibold">{metrics.overduePercentage.toFixed(1)}%</div>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-between p-4">
                    <div className="text-2xl font-bold">{metrics.overdueCount}</div>
                    <div className="text-right">
                        <p className="text-lg font-bold">{metrics.overdueRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </CardContent>
            </Card>
          
            <Card className="flex flex-col">
                <CardHeader className="bg-yellow-600/10 dark:bg-yellow-800/20 text-yellow-600 dark:text-yellow-400 flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 rounded-t-lg">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <CalendarIcon className="h-4 w-4" /> Vencem Hoje
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-between p-4">
                    <div className="text-2xl font-bold">{metrics.dueTodayCount}</div>
                    <div className="text-right">
                        <p className="text-lg font-bold">{metrics.dueTodayRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="flex flex-col">
                <CardHeader className="bg-blue-600/10 dark:bg-blue-800/20 text-blue-600 dark:text-blue-400 flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4 rounded-t-lg">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Vencem em 3 Dias
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex items-center justify-between p-4">
                    <div className="text-2xl font-bold">{metrics.dueIn3DaysCount}</div>
                     <div className="text-right">
                        <p className="text-lg font-bold">{metrics.dueIn3DaysRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </CardContent>
            </Card>
        </div>
  
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className='text-center sm:text-left'>
                        <CardTitle>Total de Vendas</CardTitle>
                        <CardDescription>Receita total no período selecionado.</CardDescription>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Select onValueChange={handleIntervalChange} value={salesInterval}>
                            <SelectTrigger className="w-full sm:w-[130px]">
                                <SelectValue placeholder="Intervalo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="today">Hoje</SelectItem>
                                <SelectItem value="month">Este Mês</SelectItem>
                                <SelectItem value="year">Este Ano</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                            </SelectContent>
                        </Select>
                        {salesInterval === 'custom' && (
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn(
                                    "w-full sm:w-[260px] justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                    )}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                        {format(dateRange.from, "dd/MM/y")} -{" "}
                                        {format(dateRange.to, "dd/MM/y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "dd/MM/y")
                                    )
                                    ) : (
                                    <span>Selecione um período</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-center sm:justify-start gap-4">
                    <DollarSign className="h-10 w-10 text-green-500"/>
                    <div className="text-4xl font-bold">
                        {totalSales.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>
    );
  };

type SortableClientKeys = 'name' | 'status' | 'dueDate' | 'subscription' | 'emails';

const ClientsPage = ({ clients, subscriptions, onToggleSupport }: { clients: Client[], subscriptions: Subscription[], onToggleSupport: (client: Client) => void }) => {
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: SortableClientKeys; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
    const [searchTerm, setSearchTerm] = useState('Ativo');
    const [inputValue, setInputValue] = useState('Ativo');
    const firestore = useFirestore();
    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const handleSearch = () => {
        setSearchTerm(inputValue);
    };

    const handleClearSearch = () => {
        setInputValue('');
        setSearchTerm('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        const lowercasedFilter = searchTerm.toLowerCase();
        return clients.filter(client => 
            client.name.toLowerCase().includes(lowercasedFilter) ||
            client.emails.some(email => email.toLowerCase().includes(lowercasedFilter)) ||
            client.status.toLowerCase().includes(lowercasedFilter) ||
            client.subscription.toLowerCase().includes(lowercasedFilter)
        );
    }, [clients, searchTerm]);

    const sortedClients = useMemo(() => {
        let sortableClients = [...filteredClients];
        if (sortConfig !== null) {
            sortableClients.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                let comparison = 0;
                if(sortConfig.key === 'emails') {
                    comparison = (aValue[0] || '').localeCompare(bValue[0] || '');
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    comparison = aValue.getTime() - bValue.getTime();
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else {
                    if (aValue < bValue) {
                        comparison = -1;
                    }
                    if (aValue > bValue) {
                        comparison = 1;
                    }
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableClients;
    }, [filteredClients, sortConfig]);

    const requestSort = (key: SortableClientKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableClientKeys) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
    };

    const handleAddClient = (client: Omit<Client, 'id' | 'status'>) => {
        if (!firestore) return;
        const now = Timestamp.now();
        const clientData = {
            ...client,
            isSupport: false,
            supportEmails: [],
            lastNotificationSent: now,
            lastReminderSent: now,
            lastRemarketingPostDueDateSent: null,
            lastRemarketingPostRegistrationSent: null,
            dueDate: client.dueDate ? (client.dueDate instanceof Timestamp ? client.dueDate : Timestamp.fromDate(new Date(client.dueDate))) : null,
            createdAt: now,
        };
        const clientsCol = collection(firestore, 'users', hardcodedUserId, 'clients');
        addDoc(clientsCol, clientData);
    };
    
    const handleUpdateClient = (updatedClient: Client) => {
        if (!firestore) return;
        const { id, status, ...clientData } = updatedClient; // remove derived status before saving
        const clientDoc = doc(firestore, 'users', hardcodedUserId, 'clients', id);
        
        const dataToUpdate = {
            ...clientData,
            dueDate: clientData.dueDate ? (clientData.dueDate instanceof Timestamp ? clientData.dueDate : Timestamp.fromDate(new Date(clientData.dueDate))) : null,
            createdAt: clientData.createdAt ? (clientData.createdAt instanceof Timestamp ? clientData.createdAt : Timestamp.fromDate(new Date(clientData.createdAt))) : Timestamp.now(),
        };
    
        updateDoc(clientDoc, dataToUpdate);
        setEditingClient(null);
    };

    const handleDeleteClient = (clientId: string) => {
        if(!firestore) return;
        const clientDoc = doc(firestore, 'users', hardcodedUserId, 'clients', clientId);
        deleteDoc(clientDoc);
    };

    const statusConfig: Record<ClientStatus, { text: string; className: string; }> = {
        ativo: { text: "Ativo", className: "bg-green-500 hover:bg-green-600 border-transparent text-white" },
        vencido: { text: "Vencido", className: "bg-yellow-500 hover:bg-yellow-600 border-transparent text-white" },
        cancelado: { text: "Cancelado", className: "bg-red-500 hover:bg-red-600 border-transparent text-white" }
    };

    return (
      <div className="w-full flex flex-col h-full">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
          <div className='flex-shrink-0 text-center sm:text-left'>
            <h2 className="text-2xl font-bold">Todos os Clientes</h2>
            <p className="text-muted-foreground">Gerencie seus clientes aqui.</p>
          </div>
          <div className='flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto'>
            <div className='w-full sm:w-auto flex-grow max-w-sm relative'>
                <Input 
                    placeholder="Pesquisar por nome, email, status..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full pr-10"
                />
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={searchTerm ? handleClearSearch : handleSearch}
                >
                    {searchTerm ? <XIcon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                    <span className="sr-only">{searchTerm ? 'Limpar pesquisa' : 'Pesquisar'}</span>
                </Button>
            </div>
            <AddEditClientDialog 
                isOpen={isAddClientDialogOpen} 
                onOpenChange={setIsAddClientDialogOpen}
                onSave={handleAddClient} 
                subscriptions={subscriptions}
                trigger={
                    <Button onClick={() => setIsAddClientDialogOpen(true)} className="w-full sm:w-auto flex-shrink-0">
                        <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Cliente
                    </Button>
                }
            />
          </div>
        </div>
        <div className="flex-grow border rounded-lg overflow-x-auto">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead onClick={() => requestSort('name')} className="cursor-pointer">
                                <div className="flex items-center">
                                    Nome {getSortIndicator('name')}
                                </div>
                            </TableHead>
                            <TableHead onClick={() => requestSort('emails')} className="cursor-pointer hidden md:table-cell">
                                <div className="flex items-center">
                                    Email {getSortIndicator('emails')}
                                </div>
                            </TableHead>
                            <TableHead onClick={() => requestSort('status')} className="cursor-pointer">
                                <div className="flex items-center">
                                    Status {getSortIndicator('status')}
                                </div>
                            </TableHead>
                            <TableHead onClick={() => requestSort('dueDate')} className="cursor-pointer hidden lg:table-cell">
                                <div className="flex items-center">
                                    Vencimento {getSortIndicator('dueDate')}
                                </div>
                            </TableHead>
                            <TableHead onClick={() => requestSort('subscription')} className="cursor-pointer hidden md:table-cell">
                                <div className="flex items-center">
                                    Assinatura {getSortIndicator('subscription')}
                                </div>
                            </TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedClients.length > 0 ? (
                            sortedClients.map((client) => {
                                const clientStatus = statusConfig[client.status];
                                return (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {client.isResale ? (
                                                <Users className="h-5 w-5 text-red-500 flex-shrink-0" />
                                            ) : (
                                                <User className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                                            )}
                                            {client.isSupport && <LifeBuoy className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                                            <span className="truncate">{client.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">
                                      <div className="flex items-center gap-1">
                                        <span className='truncate max-w-[150px]'>{client.emails[0]}</span>
                                        {client.emails.length > 1 && (
                                            <span className="text-xs text-muted-foreground">+{client.emails.length - 1}</span>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn(clientStatus.className, "text-white")}>{clientStatus.text}</Badge>
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell">
                                        {client.dueDate ? format(new Date(client.dueDate as Date), 'dd/MM/yyyy') : 'N/A'}
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{client.subscription}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Abrir menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <ViewClientDetailsDialog client={client} onEdit={() => setEditingClient(client)} subscriptions={subscriptions} onUpdateClient={handleUpdateClient} trigger={
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                        <Eye className="mr-2 h-4 w-4" />
                                                        <span>Visualizar Detalhes</span>
                                                    </DropdownMenuItem>
                                                }/>
                                                <SendMessageDialog client={client} trigger={
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                        <MessageSquare className="mr-2 h-4 w-4" />
                                                        <span>Enviar Mensagem</span>
                                                    </DropdownMenuItem>
                                                } />
                                                <DropdownMenuItem onClick={() => onToggleSupport(client)}>
                                                    <LifeBuoy className="mr-2 h-4 w-4" />
                                                    <span>Marcar Suporte</span>
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem className='text-destructive focus:text-destructive' onSelect={(e) => e.preventDefault()}>
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            <span>Apagar Cliente</span>
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Essa ação não pode ser desfeita. Isso excluirá permanentemente o cliente.
                                                        </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteClient(client.id)}>Apagar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )})
                        ) : (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Nenhum cliente encontrado.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        {editingClient && (
            <AddEditClientDialog
                isOpen={!!editingClient}
                onOpenChange={(isOpen) => !isOpen && setEditingClient(null)}
                clientToEdit={editingClient}
                onSave={handleUpdateClient}
                subscriptions={subscriptions}
            />
        )}
      </div>
    );
};

const AddEditClientDialog = ({ isOpen, onOpenChange, clientToEdit, onSave, subscriptions, trigger }: { isOpen: boolean, onOpenChange: (isOpen: boolean) => void, clientToEdit?: Client, onSave: (client: any) => void, subscriptions: Subscription[], trigger?: React.ReactNode }) => {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [emails, setEmails] = useState(['']);
    const [notes, setNotes] = useState('');
    const [subscription, setSubscription] = useState('');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [dueTime, setDueTime] = useState({ hour: '23', minute: '59' });
    const [selectedDueDate, setSelectedDueDate] = useState<'15' | '1' | '3' | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | 'boleto' | null>(null);
    const [amountPaid, setAmountPaid] = useState<number | string>('');
    const [amountPaidDisplay, setAmountPaidDisplay] = useState('');
    const [isResale, setIsResale] = useState(false);
    
    const emailScrollAreaRef = useRef<HTMLDivElement>(null);
    const isEditMode = !!clientToEdit;

    const resetForm = () => {
        setName('');
        setPhone('');
        setEmails(['']);
        setNotes('');
        setSubscription('');
        setDueDate(null);
        setDueTime({ hour: '23', minute: '59' });
        setSelectedDueDate(null);
        setPaymentMethod(null);
        setAmountPaid('');
        setAmountPaidDisplay('');
        setIsResale(false);
    };

    const updateDueDate = (date: Date | null, time: {hour: string, minute: string}) => {
        if (!date) {
            setDueDate(null);
            return;
        }
        const hour = parseInt(time.hour, 10);
        const minute = parseInt(time.minute, 10);
        let newDate = setHours(date, isNaN(hour) ? 23 : Math.min(23, Math.max(0, hour)));
        newDate = setMinutes(newDate, isNaN(minute) ? 59 : Math.min(59, Math.max(0, minute)));
        newDate = setSeconds(newDate, 59);
        setDueDate(newDate);
    };

    const handleTimeChange = (part: 'hour' | 'minute', value: string) => {
        const newTime = { ...dueTime, [part]: value };
        setDueTime(newTime);
        updateDueDate(dueDate, newTime);
    };

    const handleDateSelect = (date: Date | undefined) => {
        const newDate = date ?? null;
        updateDueDate(newDate, dueTime);
        setSelectedDueDate(null);
    };

    const setQuickDueDate = (days: number, months: number) => {
        const newDate = addMonths(addDays(new Date(), days), months);
        updateDueDate(newDate, { hour: '23', minute: '59' });
        setDueTime({ hour: '23', minute: '59' });
    };

    useEffect(() => {
        if (clientToEdit) {
            setName(clientToEdit.name);
            setPhone(clientToEdit.phone);
            setEmails(clientToEdit.emails.length > 0 ? clientToEdit.emails : ['']);
            setNotes(clientToEdit.notes);
            setSubscription(clientToEdit.subscription);
            const initialDate = clientToEdit.dueDate ? new Date(clientToEdit.dueDate as Date) : null;
            setDueDate(initialDate);
            if (initialDate) {
                setDueTime({ 
                    hour: getHours(initialDate).toString().padStart(2, '0'), 
                    minute: getMinutes(initialDate).toString().padStart(2, '0') 
                });
            } else {
                setDueTime({ hour: '23', minute: '59' });
            }
            setPaymentMethod(clientToEdit.paymentMethod);
            setAmountPaid(clientToEdit.amountPaid ?? '');
            setAmountPaidDisplay(clientToEdit.amountPaid ? clientToEdit.amountPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
            setIsResale(clientToEdit.isResale);
        } else {
            resetForm();
            const now = new Date();
            setDueTime({ 
                hour: getHours(now).toString().padStart(2, '0'), 
                minute: getMinutes(now).toString().padStart(2, '0') 
            });
        }
    }, [clientToEdit, isOpen]);

    const quantity = isResale ? emails.filter(e => e.trim() !== '').length : 1;

    const handleSaveClient = () => {
        const finalEmails = emails.filter(e => e.trim() !== '');
      if (name && phone && subscription && finalEmails.length > 0) {
        const clientData = { 
            name, 
            phone, 
            emails: finalEmails, 
            notes, 
            subscription, 
            dueDate,
            paymentMethod,
            amountPaid: typeof amountPaid === 'string' ? parseFloat(amountPaid) : amountPaid,
            isResale,
            quantity
        };
        
        if(isEditMode && clientToEdit) {
            onSave({ ...clientToEdit, ...clientData });
        } else {
            onSave(clientData);
        }
        onOpenChange(false);
      }
    };
    
    useEffect(() => {
        if (!isOpen) {
            resetForm();
        }
    }, [isOpen]);

    const handleEmailChange = (index: number, value: string) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        setEmails(newEmails);
    };
    
    const addEmailField = () => {
        setEmails(prevEmails => [...prevEmails, '']);
        setTimeout(() => {
            const viewport = emailScrollAreaRef.current?.querySelector('div');
            if (viewport) {
                viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
            }
        }, 100);
    };
    
    const removeEmailField = (index: number) => {
        const newEmails = emails.filter((_, i) => i !== index);
        setEmails(newEmails);
    };

    const updatePrice = (subName: string, currentQuantity: number) => {
        setSubscription(subName);
        const selectedSub = subscriptions.find(s => s.name === subName);
        if (selectedSub) {
            const totalPrice = selectedSub.price * currentQuantity;
            setAmountPaid(totalPrice);
            setAmountPaidDisplay(totalPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        } else {
            setAmountPaid('');
            setAmountPaidDisplay('');
        }
    };
    
    const handleSubscriptionChange = (subName: string) => {
        const currentQuantity = isResale ? Math.max(1, emails.filter(e => e.trim() !== '').length) : 1;
        updatePrice(subName, currentQuantity);
    }

    const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        setAmountPaidDisplay(rawValue);

        const numericValue = parseFloat(rawValue.replace(/[^0-9,]/g, '').replace(',', '.'));
        if (!isNaN(numericValue)) {
            setAmountPaid(numericValue);
        } else {
            setAmountPaid('');
        }
    };

    const handleAmountPaidBlur = () => {
        const numericValue = typeof amountPaid === 'string' ? parseFloat(amountPaid) : amountPaid;
        if (numericValue !== null && !isNaN(numericValue) && amountPaid !== '') {
            setAmountPaidDisplay(numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        } else {
            setAmountPaidDisplay('');
        }
    };
    
    const handleResaleChange = (checked: boolean) => {
        setIsResale(checked);
        if (!checked) {
            setEmails(emails.length > 1 ? [emails[0]] : emails);
        }
    };

    const dialogTitle = isEditMode ? 'Editar Cliente' : 'Adicionar Novo Cliente';
    const dialogDescription = isEditMode ? 'Altere os detalhes do cliente abaixo.' : 'Preencha os detalhes do cliente abaixo.';
    const saveButtonText = isEditMode ? 'Salvar Alterações' : 'Salvar Cliente';

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{dialogTitle}</DialogTitle>
                    <DialogDescription>{dialogDescription}</DialogDescription>
                </DialogHeader>
                <Tabs defaultValue="data">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="data">Dados</TabsTrigger>
                        <TabsTrigger value="vencimento">Vencimento</TabsTrigger>
                        <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
                    </TabsList>
                    <TabsContent value="data">
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="name" className="text-right">Nome</Label>
                                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="col-span-3" placeholder="Nome do Cliente"/>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="phone" className="text-right">Número</Label>
                                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="col-span-3" placeholder="(00) 00000-0000"/>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <div/>
                                <div className="col-span-3 flex items-center space-x-2">
                                    <Checkbox id="resale" checked={isResale} onCheckedChange={(checked) => handleResaleChange(checked as boolean)} />
                                    <label
                                        htmlFor="resale"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        REVENDA CONTA
                                    </label>
                                </div>
                            </div>
                            <ScrollArea className="h-auto max-h-[240px] pr-4" viewportRef={emailScrollAreaRef}>
                               <div className="space-y-4">
                                    {emails.map((email, index) => (
                                        <div className="grid grid-cols-4 items-center gap-4" key={index}>
                                            <Label htmlFor={`email-${index}`} className="text-right">
                                                Email {isResale ? index + 1 : ''}
                                            </Label>
                                            <div className='col-span-3 flex items-center gap-2'>
                                                <Input
                                                    id={`email-${index}`}
                                                    type="email"
                                                    value={email}
                                                    onChange={(e) => handleEmailChange(index, e.target.value)}
                                                    placeholder="email@exemplo.com"
                                                />
                                                {isResale && emails.length > 1 && (
                                                    <Button variant="ghost" size="icon" onClick={() => removeEmailField(index)}>
                                                        <Trash className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            {isResale && (
                                <div className="grid grid-cols-4 items-center gap-4 mt-2">
                                    <div/>
                                    <div className='col-span-3'>
                                        <Button variant="outline" size="sm" onClick={addEmailField}>
                                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Email
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                    <TabsContent value="vencimento">
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">
                                    Definir
                                </Label>
                                <div className="col-span-3 flex flex-col gap-2">
                                    <div className='flex gap-2'>
                                        <Button variant={selectedDueDate === '15' ? 'default' : 'outline'} size="sm" onClick={() => {setQuickDueDate(15, 0); setSelectedDueDate('15')}}>15 dias</Button>
                                        <Button variant={selectedDueDate === '1' ? 'default' : 'outline'} size="sm" onClick={() => {setQuickDueDate(0, 1); setSelectedDueDate('1')}}>1 mês</Button>
                                        <Button variant={selectedDueDate === '3' ? 'default' : 'outline'} size="sm" onClick={() => {setQuickDueDate(0, 3); setSelectedDueDate('3')}}>3 meses</Button>
                                    </div>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                            variant={"outline"}
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !dueDate && "text-muted-foreground"
                                            )}
                                            >
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dueDate ? format(dueDate, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                            mode="single"
                                            selected={dueDate ?? undefined}
                                            onSelect={handleDateSelect}
                                            initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <div className="flex items-center gap-2">
                                        <Input
                                            type="number"
                                            value={dueTime.hour}
                                            onChange={(e) => handleTimeChange('hour', e.target.value)}
                                            className="w-16"
                                            placeholder="HH"
                                        />
                                        <span>:</span>
                                        <Input
                                            type="number"
                                            value={dueTime.minute}
                                            onChange={(e) => handleTimeChange('minute', e.target.value)}
                                            className="w-16"
                                            placeholder="MM"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label htmlFor="notes" className="text-right pt-2">Notas</Label>
                                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="col-span-3" placeholder="Adicione uma observação..."/>
                            </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="pagamento">
                        <div className="grid gap-4 py-4">
                            {isResale && (
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="quantity" className="text-right">Quantidade</Label>
                                    <Input
                                        id="quantity"
                                        type="number"
                                        value={quantity}
                                        className="col-span-3"
                                        readOnly
                                        disabled
                                    />
                                </div>
                            )}
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="subscription" className="text-right">Assinatura</Label>
                                <Select onValueChange={handleSubscriptionChange} value={subscription}>
                                    <SelectTrigger className="col-span-3">
                                        <SelectValue placeholder="Selecione uma assinatura" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {subscriptions.map((sub) => (
                                            <SelectItem key={sub.id} value={sub.name}>{sub.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-4 items-start gap-4">
                                <Label className="text-right pt-2">Meio</Label>
                                <div className="col-span-3 flex gap-2">
                                    <Button variant={paymentMethod === 'pix' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('pix')}>PIX</Button>
                                    <Button variant={paymentMethod === 'cartao' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('cartao')}>Cartão</Button>
                                    <Button variant={paymentMethod === 'boleto' ? 'default' : 'outline'} size="sm" onClick={() => setPaymentMethod('boleto')}>Boleto</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="amountPaid" className="text-right">Valor Pago</Label>
                                <Input 
                                    id="amountPaid" 
                                    type="text"
                                    value={amountPaidDisplay} 
                                    onChange={handleAmountPaidChange} 
                                    onBlur={handleAmountPaidBlur}
                                    onFocus={(e) => setAmountPaidDisplay(typeof amountPaid === 'number' ? amountPaid.toString().replace('.', ',') : '')}
                                    className="col-span-3" 
                                    placeholder="R$ 0,00"
                                />
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSaveClient} type="submit">{saveButtonText}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const SettingsPage = ({ subscriptions, allClients }: { subscriptions: Subscription[], allClients: Client[] }) => {
    const [newSubscriptionName, setNewSubscriptionName] = useState('');
    const [newSubscriptionPrice, setNewSubscriptionPrice] = useState('');
    const [editingSubscription, setEditingSubscription] = useState<Subscription | null>(null);
    const [editedName, setEditedName] = useState('');
    const [editedPrice, setEditedPrice] = useState('');
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [confirmationText, setConfirmationText] = useState('');
    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const handleAddSubscription = () => {
      if (newSubscriptionName.trim() && newSubscriptionPrice && firestore) {
        const newSubscription = {
          name: newSubscriptionName.trim(),
          price: parseFloat(newSubscriptionPrice),
        };
        const subscriptionsCol = collection(firestore, 'users', hardcodedUserId, 'subscriptions');
        addDoc(subscriptionsCol, newSubscription);
        setNewSubscriptionName('');
        setNewSubscriptionPrice('');
      }
    };

    const handleDeleteSubscription = (subscriptionId: string) => {
        if (!firestore) return;
        const subDoc = doc(firestore, 'users', hardcodedUserId, 'subscriptions', subscriptionId);
        deleteDoc(subDoc);
    };

    const openEditDialog = (subscription: Subscription) => {
        setEditingSubscription(subscription);
        setEditedName(subscription.name);
        setEditedPrice(subscription.price.toString());
    };

    const handleEditSubscription = () => {
        if (editingSubscription && editedName.trim() && editedPrice && firestore) {
            const subDoc = doc(firestore, 'users', hardcodedUserId, 'subscriptions', editingSubscription.id);
            updateDoc(subDoc, {
                name: editedName.trim(),
                price: parseFloat(editedPrice)
            });
            setEditingSubscription(null);
            setEditedName('');
            setEditedPrice('');
        }
    };

    const handleDeleteAllClients = () => {
        startTransition(async () => {
            if (!firestore) {
                toast({
                    variant: 'destructive',
                    title: 'Erro',
                    description: 'Banco de dados não disponível.',
                });
                return;
            }
            if (allClients.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Aviso',
                    description: 'Não há clientes para apagar.',
                });
                return;
            }

            try {
                const batch = writeBatch(firestore);
                allClients.forEach(client => {
                    const clientDocRef = doc(firestore, 'users', hardcodedUserId, 'clients', client.id);
                    batch.delete(clientDocRef);
                });
                await batch.commit();
                toast({
                    title: 'Sucesso!',
                    description: 'Todos os clientes foram apagados.',
                });
                setConfirmationText('');
            } catch (error) {
                console.error("Error deleting all clients:", error);
                toast({
                    variant: 'destructive',
                    title: 'Erro ao Apagar',
                    description: 'Não foi possível apagar os clientes. Tente novamente.',
                });
            }
        });
    };

    return (
        <div className="w-full space-y-6">
            <div className="text-center sm:text-left">
                <h2 className="text-2xl font-bold">Configurações</h2>
                <p className="text-muted-foreground">Gerencie suas assinaturas e outras configurações.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Adicionar Nova Assinatura</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            placeholder="Nome da Assinatura"
                            value={newSubscriptionName}
                            onChange={(e) => setNewSubscriptionName(e.target.value)}
                            className="sm:w-1/2"
                        />
                        <Input
                            placeholder="Preço (ex: 49.90)"
                            type="number"
                            value={newSubscriptionPrice}
                            onChange={(e) => setNewSubscriptionPrice(e.target.value)}
                            className="sm:w-1/4"
                        />
                        <Button onClick={handleAddSubscription} className="w-full sm:w-auto">
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="border rounded-lg overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Assinatura</TableHead>
                            <TableHead>Preço</TableHead>
                            <TableHead className="text-right w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subscriptions.length > 0 ? (
                            subscriptions.map((sub) => (
                                <TableRow key={sub.id}>
                                    <TableCell className="font-medium">{sub.name}</TableCell>
                                    <TableCell>
                                        {sub.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => openEditDialog(sub)}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    <span>Editar</span>
                                                </DropdownMenuItem>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                                            <Trash className="mr-2 h-4 w-4" />
                                                            <span>Apagar</span>
                                                        </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Essa ação não pode ser desfeita. Isso excluirá permanentemente a assinatura.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteSubscription(sub.id)}>Apagar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={3} className="h-24 text-center">
                                    Nenhuma assinatura criada ainda.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            <Card className="border-destructive">
                <CardHeader>
                    <CardTitle className="text-destructive flex items-center gap-2">
                        <ShieldAlert className="h-5 w-5" />
                        Zona de Risco
                    </CardTitle>
                    <CardDescription>
                        Ações nesta seção são permanentes e não podem ser desfeitas.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p>
                        Apagar todos os clientes removerá permanentemente todos os registros de clientes da sua conta.
                    </p>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isPending || allClients.length === 0}>
                                {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Trash className="mr-2 h-4 w-4" />}
                                Apagar Todos os Clientes
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirmação Final Necessária</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta é uma ação irreversível. Para confirmar, digite <strong className="text-foreground">apagar tudo</strong> no campo abaixo.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <Input
                                type="text"
                                value={confirmationText}
                                onChange={(e) => setConfirmationText(e.target.value)}
                                placeholder="apagar tudo"
                                className="mt-2"
                            />
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setConfirmationText('')}>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={handleDeleteAllClients}
                                    disabled={confirmationText !== 'apagar tudo' || isPending}
                                >
                                    {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : 'Eu entendo, apagar tudo'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </CardContent>
            </Card>

            <Dialog open={!!editingSubscription} onOpenChange={(isOpen) => !isOpen && setEditingSubscription(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Editar Assinatura</DialogTitle>
                        <DialogDescription>
                            Altere os detalhes da sua assinatura abaixo.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-name" className="text-right">
                                Nome
                            </Label>
                            <Input
                                id="edit-name"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-price" className="text-right">
                                Preço
                            </Label>
                            <Input
                                id="edit-price"
                                type="number"
                                value={editedPrice}
                                onChange={(e) => setEditedPrice(e.target.value)}
                                className="col-span-3"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="secondary" onClick={() => setEditingSubscription(null)}>Cancelar</Button>
                        </DialogClose>
                        <Button onClick={handleEditSubscription}>Salvar Alterações</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const ViewClientDetailsDialog = ({ client, trigger, onEdit, subscriptions, onUpdateClient }: { client: Client; trigger: React.ReactNode; onEdit: () => void; subscriptions: Subscription[]; onUpdateClient: (client: Client) => void; }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isRenewOpen, setIsRenewOpen] = useState(false);
    const scrollViewportRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    const handleCopyEmails = () => {
        const emailsString = client.emails.join('\n');
        navigator.clipboard.writeText(emailsString).then(() => {
            toast({
                title: "E-mails copiados!",
                description: "Todos os e-mails foram copiados para a área de transferência."
            });
        }).catch(err => {
            console.error("Failed to copy emails: ", err);
            toast({
                variant: "destructive",
                title: "Falha ao copiar",
                description: "Não foi possível copiar os e-mails."
            });
        });
    };

    const paymentMethodIcons = {
        pix: <Banknote className="h-4 w-4 text-green-500" />,
        cartao: <CreditCard className="h-4 w-4 text-blue-500" />,
        boleto: <FileText className="h-4 w-4 text-orange-500" />,
      };
    
    const scrollEmails = (direction: 'up' | 'down') => {
        if (scrollViewportRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollViewportRef.current;
            const scrollAmount = clientHeight * 0.8; 

            if (direction === 'down') {
                scrollViewportRef.current.scrollTo({ top: scrollTop + scrollAmount, behavior: 'smooth' });
            } else {
                scrollViewportRef.current.scrollTo({ top: scrollTop - scrollAmount, behavior: 'smooth' });
            }
        }
    };

    const handleRenewSave = (updatedClient: Client) => {
        onUpdateClient(updatedClient);
        setIsRenewOpen(false);
        setIsOpen(false);
    }
    
    const statusConfig: Record<ClientStatus, { text: string; badge: string; icon: JSX.Element }> = {
        ativo: { text: "Ativo", badge: "default", icon: <BadgeCheck className="h-5 w-5 text-green-500" /> },
        vencido: { text: "Vencido", badge: "secondary", icon: <AlertTriangle className="h-5 w-5 text-yellow-500" /> },
        cancelado: { text: "Cancelado", badge: "destructive", icon: <BadgeX className="h-5 w-5 text-red-500" /> }
    };
    const clientStatus = statusConfig[client.status];


    return (
        <>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogTrigger asChild>{trigger}</DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-3">
                        {client.isResale ? (
                            <Users className="h-6 w-6 text-red-500" />
                        ) : (
                            <User className="h-6 w-6 text-yellow-400" />
                        )}
                        {client.name}
                        </DialogTitle>
                        <DialogDescription>
                            Visualizando detalhes completos do cliente.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">{client.phone}</span>
                            </div>
                            <div className="flex flex-col items-start gap-1">
                                <div className='flex items-center gap-2'>
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <span className='font-medium truncate max-w-[200px]'>
                                        {client.emails.length > 0 ? client.emails[0] : 'Nenhum email'}
                                    </span>
                                    {client.emails.length > 1 && (
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-80 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
                                                <div className="p-2 pb-2 text-center">
                                                    <h4 className="font-medium leading-none">Emails Associados</h4>
                                                </div>
                                                <div className="relative p-2">
                                                    <Button variant="ghost" size="icon" className="absolute top-1 left-1/2 -translate-x-1/2 h-6 w-6 z-10 bg-background/50 backdrop-blur-sm" onClick={() => scrollEmails('up')}>
                                                        <ChevronUp className="h-4 w-4" />
                                                    </Button>
                                                    <ScrollArea className="h-40 rounded-md border" viewportRef={scrollViewportRef}>
                                                        <div className="flex flex-col gap-2 p-2">
                                                            {client.emails.map((email, i) => (
                                                                <div key={i} className="text-sm p-2 bg-muted/50 rounded-md break-all">
                                                                    {email}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </ScrollArea>
                                                    <Button variant="ghost" size="icon" className="absolute bottom-1 left-1/2 -translate-x-1/2 h-6 w-6 z-10 bg-background/50 backdrop-blur-sm" onClick={() => scrollEmails('down')}>
                                                        <ChevronDown className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="p-2">
                                                    <Button size="sm" className="w-full" onClick={handleCopyEmails}>
                                                        <Copy className="mr-2 h-4 w-4" />
                                                        Copiar Todos
                                                    </Button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    )}
                                     {client.emails.length > 1 && (
                                        <span className='text-xs text-muted-foreground'>
                                            +{client.emails.length - 1} email(s) restante(s)
                                        </span>
                                    )}
                                </div>
                               
                            </div>
                            {client.notes && (
                                <div className="flex items-start gap-3">
                                    <FileText className="h-5 w-5 text-muted-foreground mt-1" />
                                    <div>
                                        <span className='font-medium'>Notas</span>
                                        <p className="text-muted-foreground text-sm">{client.notes}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                {clientStatus.icon}
                                <Badge variant={clientStatus.badge as any} className='capitalize'>{clientStatus.text}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">{client.subscription}</span>
                                {client.isResale && <Badge variant="secondary">x{client.quantity}</Badge>}
                            </div>
                            <div className="flex items-center gap-3">
                                <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">
                                    Vencimento: {client.dueDate ? format(new Date(client.dueDate as Date), 'dd/MM/yyyy HH:mm') : 'N/A'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Separator className="my-2" />

                    <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                        <div className="flex items-center gap-3">
                            {client.paymentMethod && paymentMethodIcons[client.paymentMethod]}
                            <span className="font-medium">
                                Meio: {client.paymentMethod ? client.paymentMethod.charAt(0).toUpperCase() + client.paymentMethod.slice(1) : 'N/A'}
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Wallet className="h-5 w-5 text-muted-foreground" />
                            <span className="font-medium">
                                Valor Pago: {client.amountPaid ? client.amountPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'}
                            </span>
                        </div>
                    </div>

                    <DialogFooter className="pt-6 gap-2 sm:gap-0">
                        <Button type="button" variant="outline" onClick={() => { setIsOpen(false); onEdit(); }}>
                            <Edit className="mr-2 h-4 w-4" /> Editar Cliente
                        </Button>
                        <Button type="button" className="bg-yellow-500 hover:bg-yellow-600 text-white" onClick={() => { setIsRenewOpen(true) }}>
                            <Repeat className="mr-2 h-4 w-4" /> Renovar
                        </Button>
                        <DialogClose asChild>
                            <Button type="button">Fechar</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <RenewSubscriptionDialog 
                isOpen={isRenewOpen}
                onOpenChange={setIsRenewOpen}
                client={client}
                onSave={handleRenewSave}
            />
        </>
    )
}

const RenewSubscriptionDialog = ({ isOpen, onOpenChange, client, onSave }: { isOpen: boolean; onOpenChange: (isOpen: boolean) => void; client: Client; onSave: (updatedClient: Client) => void; }) => {
    const [amountPaid, setAmountPaid] = useState<number | string>('');
    const [amountPaidDisplay, setAmountPaidDisplay] = useState('');
    const [dueDate, setDueDate] = useState<Date | null>(null);
    const [dueTime, setDueTime] = useState({ hour: '23', minute: '59' });
    const [selectedDueDate, setSelectedDueDate] = useState<'15' | '1' | '3' | null>(null);

    const updateDueDate = (date: Date | null, time: {hour: string, minute: string}) => {
        if (!date) {
            setDueDate(null);
            return;
        }
        const hour = parseInt(time.hour, 10);
        const minute = parseInt(time.minute, 10);
        let newDate = setHours(date, isNaN(hour) ? 23 : Math.min(23, Math.max(0, hour)));
        newDate = setMinutes(newDate, isNaN(minute) ? 59 : Math.min(59, Math.max(0, minute)));
        newDate = setSeconds(newDate, 59);
        setDueDate(newDate);
    };

    const handleTimeChange = (part: 'hour' | 'minute', value: string) => {
        const newTime = { ...dueTime, [part]: value };
        setDueTime(newTime);
        updateDueDate(dueDate, newTime);
    };

    const handleDateSelect = (date: Date | undefined) => {
        const newDate = date ?? null;
        updateDueDate(newDate, dueTime);
        setSelectedDueDate(null);
    };

    useEffect(() => {
        if (isOpen) {
            const currentDueDate = client.dueDate ? new Date(client.dueDate as Date) : new Date();
            const initialAmount = client.amountPaid ?? '';
            setAmountPaid(initialAmount);
            setAmountPaidDisplay(initialAmount ? Number(initialAmount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '');
            setSelectedDueDate(null);

            const baseDate = (currentDueDate && isFuture(currentDueDate)) ? currentDueDate : new Date();
            setDueDate(baseDate);
            setDueTime({
                hour: getHours(baseDate).toString().padStart(2, '0'),
                minute: getMinutes(baseDate).toString().padStart(2, '0'),
            });
        }
    }, [isOpen, client]);

    const handleSaveRenewal = () => {
        const updatedClient = {
            ...client,
            amountPaid: typeof amountPaid === 'string' ? parseFloat(amountPaid) : amountPaid,
            dueDate: dueDate,
            status: 'ativo' as const, // Explicitly set status to active on renewal
        };
        onSave(updatedClient);
    };

    const handleAmountPaidChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        setAmountPaidDisplay(rawValue);

        const numericValue = parseFloat(rawValue.replace(/[^0-9,]/g, '').replace(',', '.'));
        if (!isNaN(numericValue)) {
            setAmountPaid(numericValue);
        } else {
            setAmountPaid('');
        }
    };

    const handleAmountPaidBlur = () => {
        const numericValue = typeof amountPaid === 'string' ? parseFloat(amountPaid) : amountPaid;
        if (numericValue !== null && !isNaN(numericValue) && amountPaid !== '') {
            setAmountPaidDisplay(numericValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
        } else {
            setAmountPaidDisplay('');
        }
    };

    const handleSetDueDate = (days: number, months: number) => {
        const baseDate = (client.dueDate && isFuture(new Date(client.dueDate as Date))) ? new Date(client.dueDate as Date) : new Date();
        let newDate = addMonths(addDays(baseDate, days), months);
        updateDueDate(newDate, { hour: '23', minute: '59' });
        setDueTime({ hour: '23', minute: '59' });
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Renovar Assinatura - {client.name}</DialogTitle>
                    <DialogDescription>Atualize o valor e o vencimento da assinatura.</DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-6 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amountPaid" className="text-right">Valor Pago</Label>
                        <Input 
                            id="amountPaid" 
                            type="text"
                            value={amountPaidDisplay} 
                            onChange={handleAmountPaidChange} 
                            onBlur={handleAmountPaidBlur}
                            onFocus={(e) => setAmountPaidDisplay(typeof amountPaid === 'number' ? amountPaid.toString().replace('.', ',') : '')}
                            className="col-span-3" 
                            placeholder="R$ 0,00"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-start gap-4">
                        <Label className="text-right pt-2">Novo Vencimento</Label>
                        <div className="col-span-3 flex flex-col gap-2">
                            <div className='flex gap-2'>
                                <Button variant={selectedDueDate === '15' ? 'default' : 'outline'} size="sm" onClick={() => {handleSetDueDate(15, 0); setSelectedDueDate('15')}}>+15 dias</Button>
                                <Button variant={selectedDueDate === '1' ? 'default' : 'outline'} size="sm" onClick={() => {handleSetDueDate(0, 1); setSelectedDueDate('1')}}>+1 mês</Button>
                                <Button variant={selectedDueDate === '3' ? 'default' : 'outline'} size="sm" onClick={() => {handleSetDueDate(0, 3); setSelectedDueDate('3')}}>+3 meses</Button>
                            </div>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full justify-start text-left font-normal",
                                        !dueDate && "text-muted-foreground"
                                    )}
                                    >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dueDate ? format(dueDate, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                    mode="single"
                                    selected={dueDate ?? undefined}
                                    onSelect={handleDateSelect}
                                    initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                             <div className="flex items-center gap-2">
                                <Input
                                    type="number"
                                    value={dueTime.hour}
                                    onChange={(e) => handleTimeChange('hour', e.target.value)}
                                    className="w-16"
                                    placeholder="HH"
                                />
                                <span>:</span>
                                <Input
                                    type="number"
                                    value={dueTime.minute}
                                    onChange={(e) => handleTimeChange('minute', e.target.value)}
                                    className="w-16"
                                    placeholder="MM"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSaveRenewal} type="submit" className="bg-yellow-500 hover:bg-yellow-600 text-white">Salvar Renovação</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};

const AutomationPage = ({ config }: { config: AutomationConfig | undefined }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
    const [message, setMessage] = useState(config?.message ?? 'Olá {cliente}! Sua assinatura venceu hoje. Para renovar, acesse nosso site.');

    const [reminderIsEnabled, setReminderIsEnabled] = useState(config?.reminderIsEnabled ?? false);
    const [reminderMessage, setReminderMessage] = useState(config?.reminderMessage ?? 'Olá {cliente}! Lembrete: sua assinatura vence em 3 dias, no dia {vencimento}.');
  
    useEffect(() => {
      setIsEnabled(config?.isEnabled ?? false);
      setMessage(config?.message ?? 'Olá {cliente}! Sua assinatura venceu hoje. Para renovar, acesse nosso site.');
      setReminderIsEnabled(config?.reminderIsEnabled ?? false);
      setReminderMessage(config?.reminderMessage ?? 'Olá {cliente}! Lembrete: sua assinatura vence em 3 dias, no dia {vencimento}.');
    }, [config]);
  
    const handleSaveAutomation = () => {
      startTransition(() => {
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Banco de dados não disponível.' });
          return;
        }
        
        const dataToSave = { 
            ...config,
            isEnabled, 
            message,
            reminderIsEnabled,
            reminderMessage,
        };

        if (config?.id) {
          const configDoc = doc(firestore, 'users', hardcodedUserId, 'automation', config.id);
          updateDoc(configDoc, dataToSave);
        } else {
          const automationCol = collection(firestore, 'users', hardcodedUserId, 'automation');
          addDoc(automationCol, dataToSave);
        }
  
        toast({
          title: 'Sucesso!',
          description: 'Configurações de automação salvas.',
        });
      });
    };

    const availableTags = ['{cliente}', '{telefone}', '{email}', '{assinatura}', '{vencimento}', '{valor}', '{status}'];
  
    return (
        <div className="w-full space-y-6">
            <div className='text-center sm:text-left'>
                <h2 className="text-2xl font-bold">Automação de Cobrança</h2>
                <p className="text-muted-foreground">Configure o envio automático de mensagens de vencimento e lembretes.</p>
            </div>

            <Tabs defaultValue="due-date" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="due-date">Mensagem de Vencimento</TabsTrigger>
                    <TabsTrigger value="reminder">Lembrete (3 dias antes)</TabsTrigger>
                </TabsList>
                
                <TabsContent value="due-date">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuração da Mensagem de Vencimento</CardTitle>
                            <CardDescription>
                                Esta mensagem será enviada automaticamente para o cliente assim que a assinatura vencer.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center space-x-4 rounded-md border p-4">
                                <Bot />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        Ativar Mensagem de Vencimento
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Habilite para enviar a mensagem quando a fatura vencer.
                                    </p>
                                </div>
                                <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="automation-message">Mensagem de Vencimento</Label>
                                <Textarea
                                    id="automation-message"
                                    placeholder="Digite sua mensagem aqui..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    className="min-h-[150px]"
                                    disabled={!isEnabled}
                                />
                                <div className="text-sm text-muted-foreground">
                                    <p>Variáveis disponíveis:</p>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                                        {availableTags.map(tag => (
                                            <code key={tag} className="bg-muted px-1.5 py-0.5 rounded-sm text-xs">{tag}</code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="reminder">
                    <Card>
                        <CardHeader>
                            <CardTitle>Configuração do Lembrete</CardTitle>
                            <CardDescription>
                                Esta mensagem será enviada como um lembrete 3 dias antes do vencimento.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center space-x-4 rounded-md border p-4">
                                <Clock className={cn(reminderIsEnabled && "animate-spin-slow")} />
                                <div className="flex-1 space-y-1">
                                    <p className="text-sm font-medium leading-none">
                                        Ativar Lembrete de 3 Dias
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                        Habilite para enviar a mensagem de lembrete.
                                    </p>
                                </div>
                                <Switch checked={reminderIsEnabled} onCheckedChange={setReminderIsEnabled} />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="reminder-message">Mensagem de Lembrete</Label>
                                <Textarea
                                    id="reminder-message"
                                    placeholder="Digite sua mensagem de lembrete aqui..."
                                    value={reminderMessage}
                                    onChange={(e) => setReminderMessage(e.target.value)}
                                    className="min-h-[150px]"
                                    disabled={!reminderIsEnabled}
                                />
                                <div className="text-sm text-muted-foreground">
                                    <p>Variáveis disponíveis:</p>
                                    <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                                        {availableTags.map(tag => (
                                            <code key={tag} className="bg-muted px-1.5 py-0.5 rounded-sm text-xs">{tag}</code>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <div className="flex justify-center sm:justify-start mt-6">
                <Button onClick={handleSaveAutomation} disabled={isPending} className='w-full sm:w-auto'>
                    {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Todas as Configurações
                </Button>
            </div>
        </div>
    );
};
  

const SendMessageDialog = ({ client, trigger, useGroupWebhook }: { client: Client; trigger: React.ReactNode; useGroupWebhook?: boolean; }) => {
    const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
  
    const handleSendMessage = () => {
        if (!message) {
            toast({
                variant: 'destructive',
                title: 'Erro',
                description: 'A mensagem não pode estar em branco.',
            });
            return;
        }

      startTransition(async () => {
        try {
          const sendMessageFn = useGroupWebhook ? sendGroupMessage : sendMessage;
          const result = await sendMessageFn(client.phone, message);

          if (result.error) {
            throw new Error(result.error);
          }
          toast({
            title: 'Sucesso!',
            description: `Mensagem enviada para ${client.name}.`,
          });
          setMessage('');
          setIsMessageDialogOpen(false);
        } catch (error) {
          console.error("Error sending message:", error);
          toast({
            variant: "destructive",
            title: "Falha no Envio",
            description: error instanceof Error ? error.message : "Não foi possível enviar a mensagem.",
          });
        }
      });
    };
  
    return (
      <Dialog open={isMessageDialogOpen} onOpenChange={setIsMessageDialogOpen}>
        <DialogTrigger asChild>
            {trigger}
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Mensagem para {client.name}</DialogTitle>
            <DialogDescription>
              Digite a mensagem que você deseja enviar para o número {client.phone}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label htmlFor="message" className="sr-only">
              Mensagem
            </Label>
            <Textarea 
              id="message" 
              placeholder="Digite sua mensagem aqui..." 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={isPending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button onClick={handleSendMessage} disabled={isPending}>
                {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
              Enviar Mensagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const MarkSupportDialog = ({ client, isOpen, onOpenChange, onSave }: { client: Client; isOpen: boolean; onOpenChange: (isOpen: boolean) => void; onSave: (clientId: string, supportEmails: string[]) => void; }) => {
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set(client.supportEmails || []));

    useEffect(() => {
        if (isOpen) {
            setSelectedEmails(new Set(client.supportEmails || []));
        }
    }, [client, isOpen]);

    const handleCheckboxChange = (email: string, checked: boolean) => {
        const newSelectedEmails = new Set(selectedEmails);
        if (checked) {
            newSelectedEmails.add(email);
        } else {
            newSelectedEmails.delete(email);
        }
        setSelectedEmails(newSelectedEmails);
    };

    const handleSave = () => {
        onSave(client.id, Array.from(selectedEmails));
        onOpenChange(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Marcar Emails de Suporte para {client.name}</DialogTitle>
                    <DialogDescription>Selecione os emails que devem ser associados ao suporte para este cliente.</DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-60 mt-4">
                    <div className="space-y-4 pr-6">
                        {client.emails.map((email, index) => (
                            <div key={index} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`support-email-${index}`}
                                    checked={selectedEmails.has(email)}
                                    onCheckedChange={(checked) => handleCheckboxChange(email, checked as boolean)}
                                />
                                <label
                                    htmlFor={`support-email-${index}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                >
                                    {email}
                                </label>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave}>Salvar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SupportPage = ({ clients, onToggleSupport, setSupportClient }: { clients: Client[], onToggleSupport: (client: Client) => void, setSupportClient: (client: Client | null) => void }) => {
    const supportClients = useMemo(() => {
        return clients.filter(c => c.isSupport);
    }, [clients]);

    const handleMarkAsResolved = (client: Client) => {
        if (client.isResale) {
            setSupportClient(client);
        } else {
            onToggleSupport(client);
        }
    };

    return (
        <div className="w-full">
            <div className="mb-6 text-center sm:text-left">
                <h2 className="text-2xl font-bold">Clientes de Suporte</h2>
                <p className="text-muted-foreground">Clientes e contatos marcados para suporte.</p>
            </div>
            
            <div className="space-y-4">
                {supportClients.length > 0 ? (
                    supportClients.map(client => (
                        <Card key={client.id}>
                            <CardHeader>
                                <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
                                    {client.isResale ? <Users className="h-5 w-5 text-red-500" /> : <User className="h-5 w-5 text-yellow-400" />}
                                    {client.name}
                                </CardTitle>
                                <CardDescription className='text-center sm:text-left'>{client.phone}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <h4 className="text-sm font-semibold mb-2">Contatos de Suporte:</h4>
                                <ul className="space-y-1 list-disc pl-5 text-sm text-muted-foreground">
                                    {(client.supportEmails && client.supportEmails.length > 0) 
                                      ? client.supportEmails.map((email, index) => <li key={index}>{email}</li>)
                                      : client.emails.map((email, index) => <li key={index}>{email}</li>)
                                    }
                                </ul>
                            </CardContent>
                            <CardFooter className="flex-col sm:flex-row gap-2">
                                <Button variant="outline" onClick={() => handleMarkAsResolved(client)} className='w-full sm:w-auto'>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Marcar como Concluído
                                </Button>
                                <SendMessageDialog client={client} trigger={
                                    <Button className='w-full sm:w-auto'>
                                        <MessageSquare className="mr-2 h-4 w-4" />
                                        Enviar Mensagem
                                    </Button>
                                } />
                            </CardFooter>
                        </Card>
                    ))
                ) : (
                    <div className="text-center py-10 border rounded-lg">
                        <LifeBuoy className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h3 className="mt-2 text-sm font-semibold text-gray-900">Nenhum cliente de suporte</h3>
                        <p className="mt-1 text-sm text-gray-500">Marque clientes na lista principal para vê-los aqui.</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const RemarketingPage = ({ config }: { config: AutomationConfig | undefined }) => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const [postDueDateIsEnabled, setPostDueDateIsEnabled] = useState(config?.remarketingPostDueDateIsEnabled ?? false);
    const [postDueDateDays, setPostDueDateDays] = useState(config?.remarketingPostDueDateDays ?? 7);
    const [postDueDateMessage, setPostDueDateMessage] = useState(config?.remarketingPostDueDateMessage ?? 'Olá {cliente}, notamos que sua assinatura venceu. Temos uma oferta especial para você voltar!');

    const [postRegistrationIsEnabled, setPostRegistrationIsEnabled] = useState(config?.remarketingPostRegistrationIsEnabled ?? false);
    const [postRegistrationDays, setPostRegistrationDays] = useState(config?.remarketingPostRegistrationDays ?? 3);
    const [postRegistrationMessage, setPostRegistrationMessage] = useState(config?.remarketingPostRegistrationMessage ?? 'Olá {cliente}, bem-vindo! Que tal dar o próximo passo e ativar sua assinatura?');
  
    useEffect(() => {
        setPostDueDateIsEnabled(config?.remarketingPostDueDateIsEnabled ?? false);
        setPostDueDateDays(config?.remarketingPostDueDateDays ?? 7);
        setPostDueDateMessage(config?.remarketingPostDueDateMessage ?? 'Olá {cliente}, notamos que sua assinatura venceu. Temos uma oferta especial para você voltar!');
        setPostRegistrationIsEnabled(config?.remarketingPostRegistrationIsEnabled ?? false);
        setPostRegistrationDays(config?.remarketingPostRegistrationDays ?? 3);
        setPostRegistrationMessage(config?.remarketingPostRegistrationMessage ?? 'Olá {cliente}, bem-vindo! Que tal dar o próximo passo e ativar sua assinatura?');
    }, [config]);
  
    const handleSaveRemarketing = () => {
      startTransition(() => {
        if (!firestore) {
          toast({ variant: 'destructive', title: 'Erro', description: 'Banco de dados não disponível.' });
          return;
        }
        
        const dataToSave = { 
            ...config,
            remarketingPostDueDateIsEnabled: postDueDateIsEnabled,
            remarketingPostDueDateDays: postDueDateDays,
            remarketingPostDueDateMessage: postDueDateMessage,
            remarketingPostRegistrationIsEnabled: postRegistrationIsEnabled,
            remarketingPostRegistrationDays: postRegistrationDays,
            remarketingPostRegistrationMessage: postRegistrationMessage,
        };

        if (config?.id) {
          const configDoc = doc(firestore, 'users', hardcodedUserId, 'automation', config.id);
          updateDoc(configDoc, dataToSave);
        } else {
          const automationCol = collection(firestore, 'users', hardcodedUserId, 'automation');
          addDoc(automationCol, dataToSave);
        }
  
        toast({
          title: 'Sucesso!',
          description: 'Configurações de remarketing salvas.',
        });
      });
    };

    const availableTags = ['{cliente}', '{telefone}', '{email}', '{assinatura}', '{vencimento}', '{valor}', '{status}'];
  
    return (
        <div className="w-full space-y-6">
            <div className='text-center sm:text-left'>
                <h2 className="text-2xl font-bold">Automação de Remarketing</h2>
                <p className="text-muted-foreground">Reengaje seus clientes com mensagens automáticas estratégicas.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Remarketing Pós-Vencimento</CardTitle>
                    <CardDescription>
                        Envie uma mensagem para clientes um tempo após a assinatura deles ter vencido.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4 rounded-md border p-4">
                        <Flame />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                                Ativar Remarketing Pós-Vencimento
                            </p>
                        </div>
                        <Switch checked={postDueDateIsEnabled} onCheckedChange={setPostDueDateIsEnabled} />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                        <Label htmlFor="post-due-date-days" className="md:text-right">Enviar após</Label>
                        <div className="col-span-3 flex items-center gap-2">
                           <Input
                                id="post-due-date-days"
                                type="number"
                                value={postDueDateDays}
                                onChange={(e) => setPostDueDateDays(Number(e.target.value))}
                                className="w-24"
                                disabled={!postDueDateIsEnabled}
                            />
                            <span>dias do vencimento.</span>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="post-due-date-message">Mensagem de Remarketing</Label>
                        <Textarea
                            id="post-due-date-message"
                            placeholder="Digite sua mensagem aqui..."
                            value={postDueDateMessage}
                            onChange={(e) => setPostDueDateMessage(e.target.value)}
                            className="min-h-[120px]"
                            disabled={!postDueDateIsEnabled}
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Remarketing Pós-Cadastro</CardTitle>
                    <CardDescription>
                        Envie uma mensagem de boas-vindas ou um lembrete para novos clientes após um tempo do cadastro.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center space-x-4 rounded-md border p-4">
                        <Users2 />
                        <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                                Ativar Remarketing Pós-Cadastro
                            </p>
                        </div>
                        <Switch checked={postRegistrationIsEnabled} onCheckedChange={setPostRegistrationIsEnabled} />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-4 items-center gap-4">
                        <Label htmlFor="post-reg-days" className="md:text-right">Enviar após</Label>
                        <div className="col-span-3 flex items-center gap-2">
                           <Input
                                id="post-reg-days"
                                type="number"
                                value={postRegistrationDays}
                                onChange={(e) => setPostRegistrationDays(Number(e.target.value))}
                                className="w-24"
                                disabled={!postRegistrationIsEnabled}
                            />
                            <span>dias do cadastro.</span>
                        </div>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="post-reg-message">Mensagem de Remarketing</Label>
                        <Textarea
                            id="post-reg-message"
                            placeholder="Digite sua mensagem aqui..."
                            value={postRegistrationMessage}
                            onChange={(e) => setPostRegistrationMessage(e.target.value)}
                            className="min-h-[120px]"
                            disabled={!postRegistrationIsEnabled}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="mt-6 text-sm text-muted-foreground">
                <p className="font-bold">Variáveis disponíveis para ambas as mensagens:</p>
                <div className="flex flex-wrap gap-x-2 gap-y-1 mt-1">
                    {availableTags.map(tag => (
                        <code key={tag} className="bg-muted px-1.5 py-0.5 rounded-sm text-xs">{tag}</code>
                    ))}
                </div>
            </div>

            <div className="flex justify-center sm:justify-start mt-6">
                <Button onClick={handleSaveRemarketing} disabled={isPending} className='w-full sm:w-auto'>
                    {isPending && <Loader className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar Configurações de Remarketing
                </Button>
            </div>
        </div>
    );
};

const NotesPage = ({ notes }: { notes: Note[] }) => {
    const [noteContent, setNoteContent] = useState('');
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();
    const hardcodedUserId = 'psozJegDEETMk9DuHrSfINHKwR2';

    const handleAddNote = () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Erro', description: 'Banco de dados não disponível.' });
            return;
        }
        if (noteContent.trim() === '') {
            toast({ variant: 'destructive', title: 'Erro', description: 'A nota não pode estar vazia.' });
            return;
        }

        const newNote: Omit<Note, 'id'> = {
            content: noteContent,
            status: 'todo',
            createdAt: Timestamp.now(),
        };

        const notesCol = collection(firestore, 'users', hardcodedUserId, 'notes');
        addDoc(notesCol, newNote);
        setNoteContent('');
        setIsPopoverOpen(false);
        toast({ title: 'Sucesso!', description: 'Sua nota foi adicionada.' });
    };

    const handleUpdateNote = (noteId: string, updates: Partial<Note>) => {
        if (!firestore) return;
        const noteDoc = doc(firestore, 'users', hardcodedUserId, 'notes', noteId);
        updateDoc(noteDoc, updates);
    };

    const handleDeleteNote = (noteId: string) => {
        if (!firestore) return;
        const noteDoc = doc(firestore, 'users', hardcodedUserId, 'notes', noteId);
        deleteDoc(noteDoc);
    };

    const onDragEnd = (result: DropResult) => {
        const { source, destination, draggableId } = result;
    
        if (!destination) {
            return;
        }
    
        const noteToMove = notes.find(n => n.id === draggableId);
        if (!noteToMove) return;
    
        const sourceList = notes.filter(n => n.status === source.droppableId);
        const destList = notes.filter(n => n.status === destination.droppableId);
        
        let newCreatedAt: Timestamp;
        
        // Calculate new timestamp for ordering
        if (destination.index === 0) {
            // Moved to the top of the list
            const nextNote = destList[0];
            const newTime = (nextNote ? nextNote.createdAt.toMillis() : Date.now()) + 1000;
            newCreatedAt = Timestamp.fromMillis(newTime);
        } else if (destination.index === destList.length) {
            // Moved to the bottom of the list (when moving to a different list)
            const prevNote = destList[destList.length - 1];
            const newTime = (prevNote ? prevNote.createdAt.toMillis() : Date.now()) - 1000;
            newCreatedAt = Timestamp.fromMillis(newTime);
        } else {
             // Moved in between two notes
            const prevNote = destList[destination.index - 1];
            const nextNote = destList[destination.index];

            const prevTime = prevNote.createdAt.toMillis();
            const nextTime = nextNote ? nextNote.createdAt.toMillis() : (prevTime - 2000);
            
            const newTime = (prevTime + nextTime) / 2;
            newCreatedAt = Timestamp.fromMillis(newTime);
        }

        handleUpdateNote(draggableId, {
            status: destination.droppableId as 'todo' | 'done',
            createdAt: newCreatedAt,
        });
    };

    const toDos = useMemo(() => notes.filter(n => n.status === 'todo'), [notes]);
    const done = useMemo(() => notes.filter(n => n.status === 'done'), [notes]);

    return (
        <div className="w-full space-y-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
                <div className='text-center sm:text-left'>
                    <h2 className="text-2xl font-bold">Notas e Tarefas</h2>
                    <p className="text-muted-foreground">Arraste as notas entre as colunas para alterar o status.</p>
                </div>
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button className='w-full sm:w-auto'>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Nota
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <h4 className="font-medium leading-none">Nova Nota</h4>
                                <p className="text-sm text-muted-foreground">
                                    Escreva sua nova tarefa ou anotação.
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Textarea
                                    value={noteContent}
                                    onChange={(e) => setNoteContent(e.target.value)}
                                    placeholder="Ex: Ligar para o cliente X amanhã"
                                />
                                <Button onClick={handleAddNote}>Salvar</Button>
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="grid md:grid-cols-2 gap-8 items-start">
                    <Droppable droppableId="todo">
                        {(provided, snapshot) => (
                            <div 
                                ref={provided.innerRef} 
                                {...provided.droppableProps}
                                className={cn("space-y-4 p-2 rounded-lg transition-colors", snapshot.isDraggingOver && "bg-yellow-500/10")}
                            >
                                <h3 className="text-lg font-semibold flex items-center gap-2 px-2">
                                    <ClipboardList className="text-yellow-500" /> A Fazer ({toDos.length})
                                </h3>
                                <div className="space-y-3 min-h-[100px]">
                                    {toDos.length > 0 ? toDos.map((note, index) => (
                                        <Draggable key={note.id} draggableId={note.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                >
                                                    <Card className="group transition-shadow hover:shadow-md">
                                                        <CardContent className="p-4 flex items-start gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-sm font-medium">{note.content}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {format(note.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm")}
                                                                </p>
                                                            </div>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Trash className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Excluir esta nota?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>Excluir</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}
                                        </Draggable>
                                    )) : (
                                        !snapshot.isDraggingOver && <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma tarefa a fazer. Adicione uma!</p>
                                    )}
                                    {provided.placeholder}
                                </div>
                            </div>
                        )}
                    </Droppable>

                    <Droppable droppableId="done">
                        {(provided, snapshot) => (
                             <div 
                                ref={provided.innerRef} 
                                {...provided.droppableProps}
                                className={cn("space-y-4 p-2 rounded-lg transition-colors", snapshot.isDraggingOver && "bg-green-500/10")}
                            >
                                <h3 className="text-lg font-semibold flex items-center gap-2 px-2">
                                    <CheckCircle className="text-green-500" /> Feitas ({done.length})
                                </h3>
                                <div className="space-y-3 min-h-[100px]">
                                    {done.length > 0 ? done.map((note, index) => (
                                         <Draggable key={note.id} draggableId={note.id} index={index}>
                                            {(provided) => (
                                                <div
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    {...provided.dragHandleProps}
                                                >
                                                    <Card className="group transition-shadow hover:shadow-md bg-muted/40">
                                                        <CardContent className="p-4 flex items-start gap-4">
                                                            <div className="flex-1">
                                                                <p className="text-sm text-muted-foreground line-through">{note.content}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {format(note.createdAt.toDate(), "dd/MM/yyyy 'às' HH:mm")}
                                                                </p>
                                                            </div>
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <Trash className="h-4 w-4 text-destructive" />
                                                                    </Button>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Excluir esta nota?</AlertDialogTitle>
                                                                        <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteNote(note.id)}>Excluir</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </CardContent>
                                                    </Card>
                                                </div>
                                            )}
                                        </Draggable>
                                    )) : (
                                        !snapshot.isDraggingOver && <p className="text-sm text-muted-foreground p-4 text-center">Nenhuma tarefa concluída ainda.</p>
                                    )}
                                    {provided.placeholder}
                                </div>
                            </div>
                        )}
                    </Droppable>
                </div>
            </DragDropContext>
        </div>
    );
}

const GroupsPage = ({ clients }: { clients: Client[] }) => {
    const [groupCode, setGroupCode] = useState('');
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    const [groupJid, setGroupJid] = useState<string | null>(null);

    const handleSendToWebhook = () => {
        if (!groupCode.trim()) {
            toast({
                variant: 'destructive',
                title: 'Link Inválido',
                description: 'Por favor, insira o código do link do grupo.',
            });
            return;
        }
        setGroupJid(null);
        startTransition(async () => {
            try {
                const result = await sendToGroupWebhook(groupCode);
                if (result.error) {
                    throw new Error(result.error);
                }
                
                if (result.JID) {
                    setGroupJid(result.JID);
                    toast({
                        title: 'Sucesso!',
                        description: `Código do grupo enviado para o webhook.`,
                    });
                } else {
                    throw new Error("Webhook não retornou um JID.");
                }
                setGroupCode('');
            } catch (error) {
                setGroupJid(null);
                toast({
                    variant: 'destructive',
                    title: 'Falha no Envio',
                    description: error instanceof Error ? error.message : "Não foi possível enviar o código para o webhook.",
                });
            }
        });
    };

    const handleCopyJid = () => {
        if (!groupJid) return;
        navigator.clipboard.writeText(groupJid).then(() => {
            toast({
                title: "Copiado!",
                description: "O Código do Grupo foi copiado."
            });
        });
    };

    return (
        <div className="w-full space-y-6">
            <div className='text-center sm:text-left'>
                <h2 className="text-2xl font-bold">Gerenciamento de Grupos</h2>
                <p className="text-muted-foreground">Obtenha códigos de grupo e envie mensagens.</p>
            </div>
            <Tabs defaultValue="get-code" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="get-code">Obter Código do Grupo</TabsTrigger>
                    <TabsTrigger value="send-messages">Mensagens para Grupo</TabsTrigger>
                </TabsList>
                
                <TabsContent value="get-code">
                    <div className="grid gap-6 max-w-lg mx-auto pt-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Obter código do grupo</CardTitle>
                                <CardDescription>
                                    Cole apenas o código do link de convite. Ex: do link https://chat.whatsapp.com/JlgDbPX9Q4g7Kij2xzlx6R, cole apenas JlgDbPX9Q4g7Kij2xzlx6R.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <Label htmlFor="group-code">Link do grupo do zap</Label>
                                    <Input
                                        id="group-code"
                                        placeholder="Insira o código do convite aqui..."
                                        value={groupCode}
                                        onChange={(e) => setGroupCode(e.target.value)}
                                    />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSendToWebhook} disabled={isPending} className="w-full">
                                    {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                                    Enviar
                                </Button>
                            </CardFooter>
                        </Card>

                        {groupJid && (
                             <Card>
                                <CardHeader>
                                    <CardTitle>Código do Grupo Retornado</CardTitle>
                                </CardHeader>
                                <CardContent>
                                   <div className="flex items-center justify-between gap-4 p-3 bg-muted rounded-md">
                                        <span className="text-sm font-mono break-all">{groupJid}</span>
                                        <Button variant="ghost" size="icon" onClick={handleCopyJid}>
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                   </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="send-messages">
                    <GroupMessageSender clients={clients} />
                </TabsContent>
            </Tabs>
        </div>
    );
};

const GroupMessageSender = ({ clients }: { clients: Client[] }) => {
    const [sortConfig, setSortConfig] = useState<{ key: SortableClientKeys; direction: 'ascending' | 'descending' } | null>({ key: 'name', direction: 'ascending' });
    const [searchTerm, setSearchTerm] = useState('');
    const [inputValue, setInputValue] = useState('');

    const handleSearch = () => {
        setSearchTerm(inputValue);
    };

    const handleClearSearch = () => {
        setInputValue('');
        setSearchTerm('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    };

    const filteredClients = useMemo(() => {
        if (!searchTerm) return clients;
        const lowercasedFilter = searchTerm.toLowerCase();
        return clients.filter(client => 
            client.name.toLowerCase().includes(lowercasedFilter) ||
            client.emails.some(email => email.toLowerCase().includes(lowercasedFilter)) ||
            client.status.toLowerCase().includes(lowercasedFilter) ||
            client.subscription.toLowerCase().includes(lowercasedFilter)
        );
    }, [clients, searchTerm]);

    const sortedClients = useMemo(() => {
        let sortableClients = [...filteredClients];
        if (sortConfig !== null) {
            sortableClients.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;
                
                let comparison = 0;
                if(sortConfig.key === 'emails') {
                    comparison = (aValue[0] || '').localeCompare(bValue[0] || '');
                } else if (aValue instanceof Date && bValue instanceof Date) {
                    comparison = aValue.getTime() - bValue.getTime();
                } else if (typeof aValue === 'string' && typeof bValue === 'string') {
                    comparison = aValue.localeCompare(bValue);
                } else {
                    if (aValue < bValue) {
                        comparison = -1;
                    }
                    if (aValue > bValue) {
                        comparison = 1;
                    }
                }

                return sortConfig.direction === 'ascending' ? comparison : -comparison;
            });
        }
        return sortableClients;
    }, [filteredClients, sortConfig]);

    const requestSort = (key: SortableClientKeys) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key: SortableClientKeys) => {
        if (!sortConfig || sortConfig.key !== key) {
            return <ArrowUpDown className="ml-2 h-4 w-4 text-muted-foreground/50" />;
        }
        return sortConfig.direction === 'ascending' ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />;
    };

    return (
        <div className="w-full flex flex-col h-full pt-6">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-4 gap-4">
                <div className='flex-shrink-0 text-center sm:text-left'>
                    <h3 className="text-lg font-bold">Disparo para Clientes</h3>
                    <p className="text-sm text-muted-foreground">Selecione um cliente para enviar uma mensagem via o webhook de grupo.</p>
                </div>
                <div className='w-full sm:w-auto flex-grow max-w-sm relative'>
                    <Input 
                        placeholder="Pesquisar cliente..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full pr-10"
                    />
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                        onClick={searchTerm ? handleClearSearch : handleSearch}
                    >
                        {searchTerm ? <XIcon className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                        <span className="sr-only">{searchTerm ? 'Limpar pesquisa' : 'Pesquisar'}</span>
                    </Button>
                </div>
            </div>
            <div className="flex-grow border rounded-lg overflow-x-auto">
                <ScrollArea className="h-full max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead onClick={() => requestSort('name')} className="cursor-pointer">
                                    <div className="flex items-center">
                                        Nome {getSortIndicator('name')}
                                    </div>
                                </TableHead>
                                <TableHead className="hidden md:table-cell">Telefone</TableHead>
                                <TableHead className="text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedClients.length > 0 ? (
                                sortedClients.map((client) => (
                                <TableRow key={client.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            {client.isResale ? (
                                                <Users className="h-5 w-5 text-red-500 flex-shrink-0" />
                                            ) : (
                                                <User className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                                            )}
                                            <span className="truncate">{client.name}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell">{client.phone}</TableCell>
                                    <TableCell className="text-right">
                                        <SendMessageDialog client={client} useGroupWebhook={true} trigger={
                                            <Button variant="outline" size="sm">
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Enviar Mensagem
                                            </Button>
                                        } />
                                    </TableCell>
                                </TableRow>
                            ))) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-24 text-center">
                                        Nenhum cliente encontrado.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </div>
        </div>
    );
};


export default AppDashboard;

    
