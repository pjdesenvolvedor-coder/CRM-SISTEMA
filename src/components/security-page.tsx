'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Shield } from 'lucide-react';

interface SecurityPageProps {
  onSuccess: () => void;
}

const CORRECT_PASSWORD = 'sabioselvagem';

export default function SecurityPage({ onSuccess }: SecurityPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const { toast } = useToast();

  const handleLogin = () => {
    if (password === CORRECT_PASSWORD) {
      toast({
        title: 'Acesso Liberado!',
        description: 'Bem-vindo ao sistema.',
      });
      onSuccess();
    } else {
      setError(true);
      toast({
        variant: 'destructive',
        title: 'Senha Incorreta',
        description: 'Por favor, tente novamente.',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="mt-4">Acesso Restrito</CardTitle>
          <CardDescription>Por favor, insira a senha para continuar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="password"
            placeholder="Digite sua senha..."
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(false);
            }}
            onKeyDown={handleKeyDown}
            className={error ? 'border-destructive' : ''}
          />
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleLogin}>
            Entrar
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
