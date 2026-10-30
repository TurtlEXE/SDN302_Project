import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FacilityFilter } from '../FacilityFilter.jsx';
import { sportService } from '../../../services/sport.service.js';

vi.mock('../../../services/sport.service.js', () => ({
  sportService: {
    getPublicSports: vi.fn(),
  },
}));

describe('FacilityFilter Component (P16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sportService.getPublicSports.mockResolvedValue({
      success: true,
      data: [
        { _id: 'sp-1', name: 'Bóng đá' },
        { _id: 'sp-2', name: 'Cầu lông' },
      ],
    });
  });

  it('renders search input and loads sports into dropdown', async () => {
    render(<FacilityFilter initialFilters={{}} onFilterChange={vi.fn()} onReset={vi.fn()} />);

    expect(screen.getByTestId('input-keyword')).toBeInTheDocument();
    expect(screen.getByTestId('select-province')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Bóng đá')).toBeInTheDocument();
      expect(screen.getByText('Cầu lông')).toBeInTheDocument();
    });
  });

  it('submits selected filters when search button is clicked', async () => {
    const onFilterChange = vi.fn();
    render(<FacilityFilter initialFilters={{}} onFilterChange={onFilterChange} onReset={vi.fn()} />);

    const keywordInput = screen.getByTestId('input-keyword');
    const provinceSelect = screen.getByTestId('select-province');

    fireEvent.change(keywordInput, { target: { value: 'Sân cỏ nhân tạo' } });
    fireEvent.change(provinceSelect, { target: { value: 'Hà Nội' } });

    fireEvent.click(screen.getByTestId('btn-search-submit'));

    expect(onFilterChange).toHaveBeenCalledTimes(1);
    expect(onFilterChange).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: 'Sân cỏ nhân tạo',
        province: 'Hà Nội',
      })
    );
  });

  it('toggles advanced filters and triggers reset', async () => {
    const onReset = vi.fn();
    render(
      <FacilityFilter
        initialFilters={{ keyword: 'test' }}
        onFilterChange={vi.fn()}
        onReset={onReset}
      />
    );

    // Expand advanced filters
    fireEvent.click(screen.getByTestId('btn-toggle-advanced'));

    expect(screen.getByTestId('input-min-price')).toBeInTheDocument();
    expect(screen.getByTestId('input-max-price')).toBeInTheDocument();
    expect(screen.getByTestId('select-sort')).toBeInTheDocument();

    // Click reset
    const resetBtn = screen.getByTestId('btn-reset-filters');
    fireEvent.click(resetBtn);

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('input-keyword')).toHaveValue('');
  });
});

