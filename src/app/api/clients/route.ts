// IMPORTANT: This file needs to be able to use firebase-admin
// It is a server-side file and should not be included in the client-side bundle.

import { NextRequest, NextResponse } from 'next/server';
import { initializeAdminApp } from '@/firebase/server'; // We will create this
import { Timestamp } from 'firebase-admin/firestore';
import { headers } from 'next/headers';

// Helper to initialize Firebase Admin SDK
const { db, auth } = initializeAdminApp();

async function getUserIdFromApiKey(apiKey: string): Promise<string | null> {
    if (!apiKey.startsWith('zapconnect_')) {
        return null;
    }
    const usersRef = db.collectionGroup('apiKeys');
    const snapshot = await usersRef.where('key', '==', apiKey).where('isEnabled', '==', true).limit(1).get();

    if (snapshot.empty) {
        return null;
    }

    // The parent of the apiKey doc is the user doc
    const userDoc = snapshot.docs[0].ref.parent.parent;
    return userDoc?.id || null;
}


export async function POST(req: NextRequest) {
    const headersList = headers();
    const authorization = headersList.get('authorization');

    if (!authorization || !authorization.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Authorization header is missing or invalid.' }, { status: 401 });
    }

    const apiKey = authorization.split('Bearer ')[1];
    
    let userId: string | null = null;
    try {
        userId = await getUserIdFromApiKey(apiKey);
    } catch(e) {
        console.error("API Key validation error:", e);
        return NextResponse.json({ error: 'Internal server error during API key validation.' }, { status: 500 });
    }

    if (!userId) {
        return NextResponse.json({ error: 'Invalid API Key.' }, { status: 401 });
    }


  try {
    const body = await req.json();

    // --- Validation ---
    const { name, phone, emails, subscription, dueDate, amountPaid, isResale, notes } = body;

    if (!name || !phone || !emails || !Array.isArray(emails) || emails.length === 0 || !subscription) {
      return NextResponse.json({ error: 'Missing required fields: name, phone, emails, and subscription are required.' }, { status: 400 });
    }

    // --- Data Transformation ---
    const quantity = (isResale && Array.isArray(emails)) ? emails.length : 1;
    const now = Timestamp.now();
    
    let dueDateTimestamp: Timestamp | null = null;
    if (dueDate) {
        const date = new Date(dueDate);
        if (!isNaN(date.getTime())) {
            dueDateTimestamp = Timestamp.fromDate(date);
        }
    }


    const clientData = {
      name,
      phone,
      emails,
      subscription,
      dueDate: dueDateTimestamp,
      amountPaid: amountPaid ?? null,
      isResale: isResale ?? false,
      notes: notes ?? '',
      quantity,
      createdAt: now,
      isSupport: false,
      supportEmails: [],
      // Set initial automation timestamps to avoid accidental sends right after creation
      lastNotificationSent: now,
      lastReminderSent: now,
      lastRemarketingPostDueDateSent: null,
      lastRemarketingPostRegistrationSent: null,
    };

    // --- Firestore Interaction ---
    const clientRef = await db.collection('users').doc(userId).collection('clients').add(clientData);

    // --- Response ---
    return NextResponse.json({
      message: 'Client created successfully',
      clientId: clientRef.id,
      data: { ...clientData, id: clientRef.id },
    }, { status: 201 });

  } catch (error) {
    console.error('API Error:', error);
    if (error instanceof SyntaxError) {
        return NextResponse.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
    }
    return NextResponse.json({ error: 'An internal server error occurred.' }, { status: 500 });
  }
}
