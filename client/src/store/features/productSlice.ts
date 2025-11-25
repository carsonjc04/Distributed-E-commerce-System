import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

interface ProductState {
    stock: number;
    status: 'idle' | 'loading' | 'succeeded' | 'failed';
    error: string | null;
}

const initialState: ProductState = {
    stock: 10,
    status: 'idle',
    error: null,
};

export const purchaseItem = createAsyncThunk(
    'product/purchaseItem',
    async (productId: string) => {
        const idempotencyKey = uuidv4();
        const userId = `user-${Math.floor(Math.random() * 10000)}`; // Simple random user for demo

        const response = await axios.post('/api/hold', {
            userId,
            productId,
            idempotencyKey,
        });
        return response.data;
    }
);

const productSlice = createSlice({
    name: 'product',
    initialState,
    reducers: {
        setStock: (state, action: PayloadAction<number>) => {
            state.stock = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(purchaseItem.pending, (state) => {
                state.status = 'loading';
                // Optimistic Update: Decrement immediately
                if (state.stock > 0) {
                    state.stock -= 1;
                }
            })
            .addCase(purchaseItem.fulfilled, (state) => {
                state.status = 'succeeded';
                // Do nothing, stock is already decremented
            })
            .addCase(purchaseItem.rejected, (state, action) => {
                state.status = 'failed';
                state.error = action.error.message || 'Purchase failed';
                // Rollback: Increment stock back
                state.stock += 1;
            });
    },
});

export const { setStock } = productSlice.actions;
export default productSlice.reducer;
