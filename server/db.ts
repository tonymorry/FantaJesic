import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import { Regulation, Season } from './models';

let connectionPromise: Promise<typeof mongoose> | null = null;
let lastDbError: string | null = null;

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim().length > 0);
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function configureCloudinary() {
  if (isCloudinaryConfigured()) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
  }
  return cloudinary;
}

export async function connectMongo(): Promise<boolean> {
  if (!isMongoConfigured()) {
    lastDbError = 'MONGODB_URI non configurata nelle variabili d’ambiente.';
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    lastDbError = null;
    return true;
  }

  try {
    if (!connectionPromise) {
      connectionPromise = mongoose.connect(process.env.MONGODB_URI!, {
        serverSelectionTimeoutMS: 8000,
      });
    }
    await connectionPromise;
    lastDbError = null;
    await ensureInitialDefaults();
    return true;
  } catch (err) {
    connectionPromise = null;
    lastDbError = err instanceof Error ? err.message : 'Errore di connessione a MongoDB Atlas';
    console.error('MongoDB connection error:', lastDbError);
    return false;
  }
}

export function getDbStatus() {
  return {
    configured: isMongoConfigured(),
    connected: mongoose.connection.readyState === 1,
    error: lastDbError,
    cloudinaryConfigured: isCloudinaryConfigured(),
  };
}

async function ensureInitialDefaults() {
  try {
    const activeSeasonCount = await Season.countDocuments({ status: 'active' });
    if (activeSeasonCount === 0) {
      const anySeasonCount = await Season.countDocuments();
      if (anySeasonCount === 0) {
        await Season.create({
          name: 'Stagione 2026/2027',
          description: 'Stagione inaugurale ufficiale della community FantaJESic.',
          status: 'active',
          startDate: new Date(),
        });
      }
    }

    const regulationExists = await Regulation.findOne({ key: 'main' });
    if (!regulationExists) {
      await Regulation.create({
        key: 'main',
        title: 'Regolamento Ufficiale FantaJESic',
        sections: [
          {
            id: 'intro',
            heading: '1. Spirito della Competizione',
            content:
              'FantaJESic trasforma la vita associativa di JESic in una competizione sana, creativa e collaborativa. Tutti gli associati partecipano alle sfide, condividono momenti nel feed social e accumulano punti per la classifica di stagione.',
          },
          {
            id: 'points',
            heading: '2. Assegnazione dei Punti',
            content:
              'I punti vengono assegnati esclusivamente dal Presidente al termine delle sfide o per meriti associativi speciali. Ogni operazione viene registrata nello storico pubblico con motivazione e data.',
          },
          {
            id: 'challenges',
            heading: '3. Sfide, Proposte e Votazioni',
            content:
              'Ogni associato può proporre nuove sfide al Presidente. Una volta approvate e pubblicate, le sfide possono prevedere una scadenza automatica e una fase di votazione con voto singolo per utente.',
          },
          {
            id: 'fairplay',
            heading: '4. Fair Play e Moderazione',
            content:
              'I contenuti pubblicati devono rispettare i valori di JESic. Il Presidente può moderare post o commenti non conformi e gestire il regolare svolgimento delle stagioni.',
          },
        ],
      });
    }
  } catch (err) {
    console.error('Error seeding structural defaults:', err);
  }
}
