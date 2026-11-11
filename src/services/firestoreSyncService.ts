import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch,
  increment,
  Unsubscribe
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../config/firebaseConfig';
import { 
  Product, 
  Sale, 
  Expense, 
  FiadoRecord, 
  Client, 
  CuentaPorPagar, 
  GastoOperativo, 
  CashShift, 
  BusinessInfo 
} from '../types';
import { getPendingSyncQueue, batchClearSyncQueue } from './indexedDBService';

export interface StoreMetadataDoc {
  updatedAt: string;
  businessInfo?: BusinessInfo;
  bcvRate?: number;
  bcvEuroRate?: number;
  activeCashShift?: CashShift | null;
  customCategories?: string[];
  lastUpdatedBy?: string;
}

export interface CashRegisterStatusDoc {
  isOpen: boolean;
  activeShift: CashShift | null;
  updatedAt: string;
  updatedBy: string;
  terminalId?: string;
  openedAt?: string;
}

export interface FirestoreStoreListeners {
  onProducts: (products: Product[]) => void;
  onSales: (sales: Sale[]) => void;
  onExpenses: (expenses: Expense[]) => void;
  onFiados: (fiados: FiadoRecord[]) => void;
  onClients: (clients: Client[]) => void;
  onCuentasPorPagar: (cuentas: CuentaPorPagar[]) => void;
  onGastosOperativos: (gastos: GastoOperativo[]) => void;
  onCashShiftHistory: (history: CashShift[]) => void;
  onMetadata: (metadata: StoreMetadataDoc) => void;
  onCashRegisterStatus?: (status: CashRegisterStatusDoc) => void;
  onError?: (error: Error) => void;
}

// Track active in-flight Firestore write operations for graceful logout flush
const activeFirestoreWrites = new Set<Promise<any>>();

export const trackFirestoreWrite = <T>(promise: Promise<T>): Promise<T> => {
  activeFirestoreWrites.add(promise);
  promise.finally(() => {
    activeFirestoreWrites.delete(promise);
  });
  return promise;
};

export const waitForAllPendingWrites = async (): Promise<void> => {
  if (activeFirestoreWrites.size > 0) {
    console.info(`[PosVenecia] Esperando confirmación de ${activeFirestoreWrites.size} operaciones en Firestore...`);
    await Promise.allSettled(Array.from(activeFirestoreWrites));
  }
};

/**
 * Strips all `undefined` fields recursively from any object or array.
 * CRITICAL: Cloud Firestore strictly crashes if any document property is `undefined`.
 */
export const cleanForFirestore = <T>(data: T): T => {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object' && !(data instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
};

/**
 * Derives the canonical unique businessId directly from the authenticated Google user.
 * Guarantees all devices logged in with the same Google account map to the exact same Firestore path.
 */
export const getCanonicalBusinessId = (uidOrEmail?: string | null): string => {
  const candidate = uidOrEmail?.trim() || auth.currentUser?.uid;
  if (!candidate) {
    throw new Error('No hay sesión de usuario autenticada para interactuar con Cloud Firestore.');
  }
  return candidate;
};

/**
 * Subscribe to all store collections in real-time for instant multi-device sync
 */
export const subscribeToStoreRealtime = (
  businessId: string,
  callbacks: FirestoreStoreListeners
): (() => void) => {
  const unsubscribers: Unsubscribe[] = [];

  const handleErr = (opType: OperationType, path: string, err: unknown) => {
    try {
      handleFirestoreError(err, opType, path);
    } catch (e: any) {
      if (callbacks.onError) callbacks.onError(e);
    }
  };

  console.info(`[PosVenecia Firestore] Iniciando suscripción en tiempo real para businessId: ${businessId}`);

  // 1. Products
  const productsPath = `businesses/${businessId}/products`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'products'),
      (snapshot) => {
        const products: Product[] = [];
        snapshot.forEach((d) => {
          products.push(d.data() as Product);
        });
        console.info(`[PosVenecia Firestore] onSnapshot: ${products.length} productos recibidos (fromCache: ${snapshot.metadata.fromCache})`);
        callbacks.onProducts(products);
      },
      (err) => handleErr(OperationType.GET, productsPath, err)
    )
  );

  // 2. Sales
  const salesPath = `businesses/${businessId}/sales`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'sales'),
      (snapshot) => {
        const sales: Sale[] = [];
        snapshot.forEach((d) => {
          sales.push(d.data() as Sale);
        });
        sales.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callbacks.onSales(sales);
      },
      (err) => handleErr(OperationType.GET, salesPath, err)
    )
  );

  // 3. Expenses
  const expensesPath = `businesses/${businessId}/expenses`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'expenses'),
      (snapshot) => {
        const expenses: Expense[] = [];
        snapshot.forEach((d) => {
          expenses.push(d.data() as Expense);
        });
        expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        callbacks.onExpenses(expenses);
      },
      (err) => handleErr(OperationType.GET, expensesPath, err)
    )
  );

  // 4. Fiados
  const fiadosPath = `businesses/${businessId}/fiados`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'fiados'),
      (snapshot) => {
        const fiados: FiadoRecord[] = [];
        snapshot.forEach((d) => {
          fiados.push(d.data() as FiadoRecord);
        });
        callbacks.onFiados(fiados);
      },
      (err) => handleErr(OperationType.GET, fiadosPath, err)
    )
  );

  // 5. Clients
  const clientsPath = `businesses/${businessId}/clients`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'clients'),
      (snapshot) => {
        const clients: Client[] = [];
        snapshot.forEach((d) => {
          clients.push(d.data() as Client);
        });
        callbacks.onClients(clients);
      },
      (err) => handleErr(OperationType.GET, clientsPath, err)
    )
  );

  // 6. Cuentas Por Pagar
  const cppPath = `businesses/${businessId}/cuentasPorPagar`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'cuentasPorPagar'),
      (snapshot) => {
        const cuentas: CuentaPorPagar[] = [];
        snapshot.forEach((d) => {
          cuentas.push(d.data() as CuentaPorPagar);
        });
        callbacks.onCuentasPorPagar(cuentas);
      },
      (err) => handleErr(OperationType.GET, cppPath, err)
    )
  );

  // 7. Gastos Operativos
  const gastosPath = `businesses/${businessId}/gastosOperativos`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'gastosOperativos'),
      (snapshot) => {
        const gastos: GastoOperativo[] = [];
        snapshot.forEach((d) => {
          gastos.push(d.data() as GastoOperativo);
        });
        callbacks.onGastosOperativos(gastos);
      },
      (err) => handleErr(OperationType.GET, gastosPath, err)
    )
  );

  // 8. Cash Shift History
  const historyPath = `businesses/${businessId}/cashShiftHistory`;
  unsubscribers.push(
    onSnapshot(
      collection(db, 'businesses', businessId, 'cashShiftHistory'),
      (snapshot) => {
        const history: CashShift[] = [];
        snapshot.forEach((d) => {
          history.push(d.data() as CashShift);
        });
        history.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
        callbacks.onCashShiftHistory(history);
      },
      (err) => handleErr(OperationType.GET, historyPath, err)
    )
  );

  // 9. Store Metadata (Tasas, perfil de negocio)
  const metaPath = `businesses/${businessId}/metadata/store`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'businesses', businessId, 'metadata', 'store'),
      (docSnap) => {
        if (docSnap.exists()) {
          callbacks.onMetadata(docSnap.data() as StoreMetadataDoc);
        }
      },
      (err) => handleErr(OperationType.GET, metaPath, err)
    )
  );

  // 10. Dedicated Cash Register Status Document (Apertura y Cierre en Tiempo Real Multi-dispositivo)
  const regStatusPath = `businesses/${businessId}/metadata/cashRegisterStatus`;
  unsubscribers.push(
    onSnapshot(
      doc(db, 'businesses', businessId, 'metadata', 'cashRegisterStatus'),
      (docSnap) => {
        if (docSnap.exists() && callbacks.onCashRegisterStatus) {
          const status = docSnap.data() as CashRegisterStatusDoc;
          console.info(`[PosVenecia Firestore] onSnapshot cashRegisterStatus: caja ${status.isOpen ? 'ABIERTA' : 'CERRADA'}`);
          callbacks.onCashRegisterStatus(status);
        }
      },
      (err) => handleErr(OperationType.GET, regStatusPath, err)
    )
  );

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
};

/**
 * Save cash register status (open/close) in Cloud Firestore for instant multi-device reflection
 */
export const saveCashRegisterStatusToFirestore = async (
  businessId: string,
  status: CashRegisterStatusDoc
): Promise<void> => {
  const path = `businesses/${businessId}/metadata/cashRegisterStatus`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore({
        ...status,
        updatedAt: new Date().toISOString()
      });
      // 1. Write dedicated status document
      await setDoc(doc(db, 'businesses', businessId, 'metadata', 'cashRegisterStatus'), cleaned, { merge: true });
      // 2. Also mirror to metadata/store for backwards compatibility
      await setDoc(
        doc(db, 'businesses', businessId, 'metadata', 'store'),
        cleanForFirestore({ activeCashShift: cleaned.activeShift, updatedAt: new Date().toISOString() }),
        { merge: true }
      );
      console.info(`[PosVenecia Firestore] Estado de caja ${status.isOpen ? 'ABIERTA' : 'CERRADA'} guardado exitosamente en Firestore.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for completeSale:
 * Saves sale document and reduces product inventory in a single atomic batch
 */
export const saveSaleAtomic = async (
  businessId: string,
  sale: Sale,
  stockDeductions: Array<{ productId: string; quantity: number }>,
  newFiado?: FiadoRecord
): Promise<void> => {
  const path = `businesses/${businessId}/sales/${sale.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      // 1. Add sale doc cleaned of any undefined values
      const cleanedSale = cleanForFirestore(sale);
      const saleRef = doc(db, 'businesses', businessId, 'sales', sale.id);
      batch.set(saleRef, cleanedSale);

      // 2. Decrement stock for physical products
      for (const item of stockDeductions) {
        if (item.productId && item.quantity > 0) {
          const prodRef = doc(db, 'businesses', businessId, 'products', item.productId);
          batch.update(prodRef, {
            stock: increment(-item.quantity)
          });
        }
      }

      // 3. Add fiado doc if payment is fiao or has remaining credit
      if (newFiado) {
        const cleanedFiado = cleanForFirestore(newFiado);
        const fiadoRef = doc(db, 'businesses', businessId, 'fiados', newFiado.id);
        batch.set(fiadoRef, cleanedFiado);
      }

      await batch.commit();
      console.info(`[PosVenecia Firestore] Venta ${sale.invoiceNumber} guardada en Firestore.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Atomic write for cancelSale:
 * Marks sale as 'anulada' and restores stock for physical products
 */
export const cancelSaleAtomic = async (
  businessId: string,
  sale: Sale,
  stockRestorations: Array<{ productId: string; quantity: number }>,
  associatedFiadoId?: string
): Promise<void> => {
  const path = `businesses/${businessId}/sales/${sale.id}`;
  const op = (async () => {
    try {
      const batch = writeBatch(db);

      // 1. Update sale status to anulada
      const saleRef = doc(db, 'businesses', businessId, 'sales', sale.id);
      batch.update(saleRef, { status: 'anulada' });

      // 2. Restore physical product stock
      for (const item of stockRestorations) {
        if (item.productId && item.quantity > 0) {
          const prodRef = doc(db, 'businesses', businessId, 'products', item.productId);
          batch.update(prodRef, {
            stock: increment(item.quantity)
          });
        }
      }

      // 3. If fiado, mark it as saldado/anulado
      if (associatedFiadoId) {
        const fiadoRef = doc(db, 'businesses', businessId, 'fiados', associatedFiadoId);
        batch.update(fiadoRef, {
          status: 'saldado',
          notes: '[VENTA ANULADA EN POS] Fiado cancelado automáticamente por anulación de factura.'
        });
      }

      await batch.commit();
      console.info(`[PosVenecia Firestore] Venta ${sale.invoiceNumber} anulada en Firestore.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update a product in Firestore directly using setDoc with merge
 */
export const saveProductToFirestore = async (businessId: string, product: Product): Promise<void> => {
  const path = `businesses/${businessId}/products/${product.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(product);
      await setDoc(doc(db, 'businesses', businessId, 'products', product.id), cleaned, { merge: true });
      console.info(`[PosVenecia Firestore] Producto guardado: ${product.name} (${product.id})`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Delete product from Firestore
 */
export const deleteProductFromFirestore = async (businessId: string, productId: string): Promise<void> => {
  const path = `businesses/${businessId}/products/${productId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'products', productId));
      console.info(`[PosVenecia Firestore] Producto eliminado: ${productId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Adjust product stock directly
 */
export const adjustProductStockInFirestore = async (businessId: string, productId: string, newStock: number): Promise<void> => {
  const path = `businesses/${businessId}/products/${productId}`;
  const op = (async () => {
    try {
      const prodRef = doc(db, 'businesses', businessId, 'products', productId);
      await setDoc(prodRef, { stock: newStock }, { merge: true });
      console.info(`[PosVenecia Firestore] Stock ajustado a ${newStock} para producto ${productId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update expense in Firestore
 */
export const saveExpenseToFirestore = async (businessId: string, expense: Expense): Promise<void> => {
  const path = `businesses/${businessId}/expenses/${expense.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(expense);
      await setDoc(doc(db, 'businesses', businessId, 'expenses', expense.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Delete expense from Firestore
 */
export const deleteExpenseFromFirestore = async (businessId: string, expenseId: string): Promise<void> => {
  const path = `businesses/${businessId}/expenses/${expenseId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'expenses', expenseId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update Fiado in Firestore
 */
export const saveFiadoToFirestore = async (businessId: string, fiado: FiadoRecord): Promise<void> => {
  const path = `businesses/${businessId}/fiados/${fiado.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(fiado);
      await setDoc(doc(db, 'businesses', businessId, 'fiados', fiado.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update Client in Firestore
 */
export const saveClientToFirestore = async (businessId: string, client: Client): Promise<void> => {
  const path = `businesses/${businessId}/clients/${client.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(client);
      await setDoc(doc(db, 'businesses', businessId, 'clients', client.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Delete Client from Firestore
 */
export const deleteClientFromFirestore = async (businessId: string, clientId: string): Promise<void> => {
  const path = `businesses/${businessId}/clients/${clientId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'clients', clientId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update Cuenta Por Pagar in Firestore
 */
export const saveCuentaPorPagarToFirestore = async (businessId: string, cuenta: CuentaPorPagar): Promise<void> => {
  const path = `businesses/${businessId}/cuentasPorPagar/${cuenta.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(cuenta);
      await setDoc(doc(db, 'businesses', businessId, 'cuentasPorPagar', cuenta.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Delete Cuenta Por Pagar from Firestore
 */
export const deleteCuentaPorPagarFromFirestore = async (businessId: string, cuentaId: string): Promise<void> => {
  const path = `businesses/${businessId}/cuentasPorPagar/${cuentaId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'cuentasPorPagar', cuentaId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save or update Gasto Operativo in Firestore
 */
export const saveGastoOperativoToFirestore = async (businessId: string, gasto: GastoOperativo): Promise<void> => {
  const path = `businesses/${businessId}/gastosOperativos/${gasto.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(gasto);
      await setDoc(doc(db, 'businesses', businessId, 'gastosOperativos', gasto.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Delete Gasto Operativo from Firestore
 */
export const deleteGastoOperativoFromFirestore = async (businessId: string, gastoId: string): Promise<void> => {
  const path = `businesses/${businessId}/gastosOperativos/${gastoId}`;
  const op = (async () => {
    try {
      await deleteDoc(doc(db, 'businesses', businessId, 'gastosOperativos', gastoId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save Cash Shift to history in Firestore
 */
export const saveCashShiftToFirestore = async (businessId: string, shift: CashShift): Promise<void> => {
  const path = `businesses/${businessId}/cashShiftHistory/${shift.id}`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore(shift);
      await setDoc(doc(db, 'businesses', businessId, 'cashShiftHistory', shift.id), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Save store metadata (rates, business profile, active shift state)
 */
export const saveStoreMetadataToFirestore = async (
  businessId: string,
  metadata: Partial<StoreMetadataDoc>
): Promise<void> => {
  const path = `businesses/${businessId}/metadata/store`;
  const op = (async () => {
    try {
      const cleaned = cleanForFirestore({
        ...metadata,
        updatedAt: new Date().toISOString()
      });
      await setDoc(doc(db, 'businesses', businessId, 'metadata', 'store'), cleaned, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  })();
  return trackFirestoreWrite(op);
};

/**
 * Flushes all pending sync queue items from IndexedDB into Cloud Firestore.
 * Used prior to logout to guarantee no transaction is lost!
 */
export const flushPendingQueueToFirestore = async (
  businessId: string
): Promise<{ flushedCount: number }> => {
  const pendingItems = await getPendingSyncQueue();
  if (pendingItems.length === 0) return { flushedCount: 0 };

  console.info(`[PosVenecia Sync] Vaciando ${pendingItems.length} transacciones pendientes hacia Cloud Firestore...`);
  const syncedIds: string[] = [];

  for (const item of pendingItems) {
    try {
      if (item.action === 'create_sale' && item.payload) {
        const sale = item.payload as Sale;
        const stockDeductions = (sale.items || [])
          .filter(i => !i.product.isService && i.product.itemType !== 'servicio')
          .map(i => ({ productId: i.product.id, quantity: i.quantity }));
        await saveSaleAtomic(businessId, sale, stockDeductions);
        syncedIds.push(item.id);
      } else if (item.action === 'create_expense' && item.payload) {
        await saveExpenseToFirestore(businessId, item.payload as Expense);
        syncedIds.push(item.id);
      } else if (item.action === 'update_product' && item.payload) {
        await saveProductToFirestore(businessId, item.payload as Product);
        syncedIds.push(item.id);
      } else if (item.action === 'close_shift' && item.payload) {
        await saveCashShiftToFirestore(businessId, item.payload as CashShift);
        syncedIds.push(item.id);
      }
    } catch (err) {
      console.error(`[PosVenecia Sync] Error al sincronizar item ${item.id} (${item.action}):`, err);
    }
  }

  if (syncedIds.length > 0) {
    await batchClearSyncQueue(syncedIds);
    console.info(`[PosVenecia Sync] ${syncedIds.length} transacciones confirmadas en Firestore.`);
  }

  return { flushedCount: syncedIds.length };
};

/**
 * Migration helper: If Firestore is clean/empty for a newly connected user,
 * populate it with their existing local/IndexedDB catalog so they never lose any data!
 */
export const checkAndMigrateLocalDataToFirestore = async (
  businessId: string,
  localData: {
    products: Product[];
    sales: Sale[];
    expenses: Expense[];
    fiados: FiadoRecord[];
    clients: Client[];
    cuentasPorPagar: CuentaPorPagar[];
    gastosOperativos: GastoOperativo[];
    cashShiftHistory: CashShift[];
    businessInfo: BusinessInfo;
    bcvRate: number;
    bcvEuroRate: number;
    cashShift?: CashShift | null;
  }
): Promise<boolean> => {
  try {
    const productsSnap = await getDocs(collection(db, 'businesses', businessId, 'products'));
    if (!productsSnap.empty) {
      // Remote already has products, do not overwrite
      return false;
    }

    if (localData.products.length === 0 && localData.sales.length === 0) {
      return false;
    }

    console.info('[PosVenecia Firestore] Migrando catálogo local a Firestore en la nube...');

    // Batch upload products in chunks of 400
    const chunkSize = 400;
    for (let i = 0; i < localData.products.length; i += chunkSize) {
      const chunk = localData.products.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const p of chunk) {
        batch.set(doc(db, 'businesses', businessId, 'products', p.id), cleanForFirestore(p));
      }
      await batch.commit();
    }

    // Batch upload clients
    if (localData.clients.length > 0) {
      const batch = writeBatch(db);
      for (const c of localData.clients) {
        batch.set(doc(db, 'businesses', businessId, 'clients', c.id), cleanForFirestore(c));
      }
      await batch.commit();
    }

    // Batch upload sales
    if (localData.sales.length > 0) {
      for (let i = 0; i < localData.sales.length; i += chunkSize) {
        const chunk = localData.sales.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        for (const s of chunk) {
          batch.set(doc(db, 'businesses', businessId, 'sales', s.id), cleanForFirestore(s));
        }
        await batch.commit();
      }
    }

    // Metadata
    await saveStoreMetadataToFirestore(businessId, {
      businessInfo: localData.businessInfo,
      bcvRate: localData.bcvRate,
      bcvEuroRate: localData.bcvEuroRate,
      activeCashShift: localData.cashShift
    });

    if (localData.cashShift) {
      await saveCashRegisterStatusToFirestore(businessId, {
        isOpen: Boolean(localData.cashShift.isOpen),
        activeShift: localData.cashShift,
        updatedAt: new Date().toISOString(),
        updatedBy: localData.cashShift.openedBy || 'Administrador'
      });
    }

    console.info('[PosVenecia Firestore] Migración a Firestore completada con éxito.');
    return true;
  } catch (err) {
    console.error('Error during Firestore migration:', err);
    return false;
  }
};
