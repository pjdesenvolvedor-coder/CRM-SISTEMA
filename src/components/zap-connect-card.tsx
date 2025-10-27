"use client";

import { useState, useEffect, useTransition } from "react";
import Image from "next/image";
import { getQRCode, getStatus, disconnect } from "@/app/actions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader,
  CheckCircle2,
  Zap,
  ZapOff,
  AlertTriangle,
  Power,
  Plug,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "loading" | "error";

interface ZapConnectCardProps {
  initialStatus: ConnectionStatus;
  profileName: string | null;
  profilePic: string | null;
  onStatusChange: (status: ConnectionStatus, profile?: { name: string | null; pic: string | null }) => void;
}

export default function ZapConnectCard({ initialStatus, profileName, profilePic, onStatusChange }: ZapConnectCardProps) {
    const [status, setStatus] = useState<ConnectionStatus>(initialStatus);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

    // Sync with parent state
    useEffect(() => {
        setStatus(initialStatus);
    }, [initialStatus]);


    const handleConnect = () => {
        startTransition(async () => {
            setStatus("connecting");
            onStatusChange("connecting");
            setQrCode(null);
            try {
                const result = await getQRCode();
                if (result.error) throw new Error(result.error);
                if (result.qrcode) {
                    setQrCode(result.qrcode);
                } else {
                    // If QR code is not received, maybe it's already connecting or connected
                    const statusResult = await getStatus();
                    if(statusResult.status !== 'connected' && statusResult.status !== 'connecting') {
                        throw new Error("QR code not received from the server.");
                    }
                }
            } catch (error) {
                console.error("Error connecting:", error);
                setStatus("error");
                onStatusChange("error");
                setQrCode(null);
                toast({
                    variant: "destructive",
                    title: "Connection Failed",
                    description: error instanceof Error ? error.message : "Could not connect to WhatsApp.",
                });
            }
        });
    };

    const handleDisconnect = () => {
        startTransition(async () => {
            try {
                await disconnect();
                setStatus("disconnected");
                onStatusChange("disconnected");
                setQrCode(null);
                toast({
                    title: "Disconnected",
                    description: "Successfully disconnected from WhatsApp.",
                });
            } catch (error) {
                console.error("Error disconnecting:", error);
                setStatus("error");
                onStatusChange("error");
                toast({
                    variant: "destructive",
                    title: "Disconnection Failed",
                    description: error instanceof Error ? error.message : "Could not disconnect.",
                });
            }
        });
    };

    const connectedContent = (
        <div className="flex flex-col items-center justify-center text-center">
            <Avatar className="w-24 h-24 mb-4 border-4 border-primary/20">
                <AvatarImage src={profilePic ?? undefined} alt={profileName ?? 'Profile'} />
                <AvatarFallback>
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                </AvatarFallback>
            </Avatar>
            <p className="font-semibold text-lg">{profileName}</p>
            <div className="flex items-center text-primary mt-1">
                <CheckCircle2 className="h-5 w-5 mr-2" />
                <p>Sua sessão está ativa.</p>
            </div>
        </div>
    );

    const statusConfig: Record<ConnectionStatus, { text: string; icon: JSX.Element; badgeVariant: "default" | "secondary" | "destructive"; description: string; content: JSX.Element; }> = {
        loading: { text: "Loading...", icon: <Loader className="mr-2 h-4 w-4 animate-spin" />, badgeVariant: "default", description: "Fetching current connection status...", content: <Loader className="h-16 w-16 animate-spin text-muted-foreground" /> },
        disconnected: { text: "Disconnected", icon: <ZapOff className="mr-2 h-4 w-4" />, badgeVariant: "secondary", description: "Click 'Connect' to pair with WhatsApp.", content: <ZapOff className="h-24 w-24 text-muted-foreground" /> },
        connecting: { text: "Connecting", icon: <Zap className="mr-2 h-4 w-4" />, badgeVariant: "default", description: "Scan the QR code with WhatsApp.", content: qrCode ? <Image src={qrCode} alt="WhatsApp QR Code" width={250} height={250} unoptimized /> : <Loader className="h-16 w-16 animate-spin text-muted-foreground" /> },
        connected: { text: "Connected", icon: <CheckCircle2 className="mr-2 h-4 w-4" />, badgeVariant: "default", description: " ", content: connectedContent },
        error: { text: "Error", icon: <AlertTriangle className="mr-2 h-4 w-4" />, badgeVariant: "destructive", description: "An error occurred. Please try again.", content: <AlertTriangle className="h-24 w-24 text-destructive" /> },
    };

    const currentStatus = statusConfig[status];

    return (
        <Card className="w-full max-w-md mx-auto shadow-2xl transition-all duration-500 animate-in fade-in-50 zoom-in-95">
            <CardHeader className="text-center">
                <CardTitle className="text-3xl font-headline flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 h-8 w-8 text-primary"><path d="M12.04 2.5a.5.5 0 0 1 .92 0l1.45 4.47a.5.5 0 0 0 .62.33l4.63-1.21a.5.5 0 0 1 .6.6l-1.2 4.63a.5.5 0 0 0 .33.62l4.47 1.45a.5.5 0 0 1 0 .92l-4.47 1.45a.5.5 0 0 0-.33.62l1.2 4.63a.5.5 0 0 1-.6.6l-4.63-1.2a.5.5 0 0 0-.62.33l-1.45 4.47a.5.5 0 0 1-.92 0l-1.45-4.47a.5.5 0 0 0-.62-.33l-4.63 1.2a.5.5 0 0 1-.6-.6l1.2-4.63a.5.5 0 0 0-.33-.62L2.5 12.46a.5.5 0 0 1 0-.92l4.47-1.45a.5.5 0 0 0 .33-.62L6.1 4.84a.5.5 0 0 1 .6-.6l4.63 1.2a.5.5 0 0 0 .62-.33z"/></svg>
                    ZapConnect
                </CardTitle>
                <div className="flex justify-center pt-2">
                    <Badge variant={currentStatus.badgeVariant} className="transition-colors duration-300">
                        {currentStatus.icon}
                        {currentStatus.text}
                    </Badge>
                </div>
                <CardDescription className="pt-2 min-h-[40px]">{currentStatus.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center min-h-[280px] p-6 bg-secondary/30 m-6 mt-0 rounded-lg">
                {currentStatus.content}
            </CardContent>
            <CardFooter className="flex justify-center px-6 pb-6">
                {(status === "disconnected" || status === "error") && (
                    <Button onClick={handleConnect} disabled={isPending} className="w-full">
                        {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Plug className="mr-2 h-4 w-4" />}
                        Connect
                    </Button>
                )}
                {(status === "connecting" || status === "connected") && (
                    <Button variant="destructive" onClick={handleDisconnect} disabled={isPending} className="w-full">
                        {isPending ? <Loader className="mr-2 h-4 w-4 animate-spin" /> : <Power className="mr-2 h-4 w-4" />}
                        Disconnect
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}