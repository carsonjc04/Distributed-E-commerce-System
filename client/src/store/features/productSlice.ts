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
    async (productId: string, { rejectWithValue }) => {
        const idempotencyKey = uuidv4();
        const userId = `user-${Math.floor(Math.random() * 10000)}`; // Simple random user for demo

        try {
            const response = await axios.post('/api/hold', {
                userId,
                productId,
                idempotencyKey,
            });
            return response.data;
        } catch (error: any) {
            // Handle API errors with better messages
            if (error.response) {
                const status = error.response.status;
                const message = error.response.data?.error || error.response.data?.message || 'Purchase failed';
                
                if (status === 409) {
                    return rejectWithValue('Sold Out - Item is no longer available');
                } else if (status === 400) {
                    return rejectWithValue('Invalid request. Please try again.');
                } else if (status >= 500) {
                    return rejectWithValue('Server error. Please try again later.');
                }
                
                return rejectWithValue(message);
            } else if (error.request) {
                return rejectWithValue('Network error. Please check your connection.');
            } else {
                return rejectWithValue('An unexpected error occurred.');
            }
        }
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
                if (state.stock > 0) {
                    state.stock -= 1;
                }
            })
            .addCase(purchaseItem.fulfilled, (state) => {
                state.status = 'succeeded';
                state.error = null; // Clear any previous errors
            })
            .addCase(purchaseItem.rejected, (state, action) => {
                state.status = 'failed';
                state.error = (action.payload as string) || action.error.message || 'Purchase failed';
                // Only rollback stock if we optimistically decremented it
                if (state.stock >= 0) {
                    state.stock += 1;
                }
            });
    },
});

export const { setStock } = productSlice.actions;
export default productSlice.reducer;
