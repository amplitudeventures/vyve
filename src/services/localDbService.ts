import { openDB, IDBPDatabase } from 'idb';
import { PhaseConfig } from '@/types/vyve';

const DB_NAME = 'vyve_analysis';
const STORE_NAME = 'phase_results';
const DB_VERSION = 1;

class LocalDbService {
  private db: Promise<IDBPDatabase>;

  constructor() {
    this.db = this.initDB();
  }

  private async initDB() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // If the store exists, delete it first
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME);
        }
        
        // Create a store of objects
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'phase',
          autoIncrement: false,
        });
        
        // Create an index on the phase field
        store.createIndex('phase', 'phase', { unique: true });
      },
    });
  }

  async savePhaseResult(phaseData: PhaseConfig): Promise<void> {
    try {
      const db = await this.db;
      // Ensure the phase number is present
      if (typeof phaseData.phase !== 'number') {
        throw new Error('Phase number is required');
      }
      await db.put(STORE_NAME, {
        ...phaseData,
        // Ensure these required fields are present
        status: phaseData.status || 'pending',
        name: phaseData.name || `Phase ${phaseData.phase}`,
        description: phaseData.description || '',
      });
    } catch (error) {
      console.error('Error saving phase result:', error);
      throw error;
    }
  }

  async getPhaseResult(phase: number): Promise<PhaseConfig | undefined> {
    try {
      const db = await this.db;
      return await db.get(STORE_NAME, phase);
    } catch (error) {
      console.error('Error getting phase result:', error);
      return undefined;
    }
  }

  async getAllPhaseResults(): Promise<PhaseConfig[]> {
    try {
      const db = await this.db;
      return await db.getAll(STORE_NAME);
    } catch (error) {
      console.error('Error getting all phase results:', error);
      return [];
    }
  }

  async clearAllPhases(): Promise<void> {
    try {
      const db = await this.db;
      await db.clear(STORE_NAME);
    } catch (error) {
      console.error('Error clearing phases:', error);
      throw error;
    }
  }

  async deletePhase(phase: number): Promise<void> {
    try {
      const db = await this.db;
      await db.delete(STORE_NAME, phase);
    } catch (error) {
      console.error('Error deleting phase:', error);
      throw error;
    }
  }
}

export const localDb = new LocalDbService(); 