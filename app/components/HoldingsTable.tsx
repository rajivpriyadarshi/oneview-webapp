export default function HoldingsTable() {
  return (
    <section className="holdings-section">
      <h3 className="holdings-title">
        <HoldingsIcon />
        Your holdings
      </h3>
      <div className="holdings-table-wrapper">
        <table className="holdings-table">
          <thead>
            <tr>
              <th>
                Security <SortIcon />
              </th>
              <th>
                Quantity <SortIcon />
              </th>
              <th>
                Current price <SortIcon />
              </th>
              <th>
                Market value <SortIcon />
              </th>
              <th>
                Cost basis <SortIcon />
              </th>
              <th className="th-right">
                Gain/Loss <SortIcon />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <span className="security-ticker">VOO</span>
                <span className="security-name">S&P 500 Vanguard ETF</span>
              </td>
              <td>9.0560</td>
              <td>&#8377;65,460.65</td>
              <td>&#8377;592,811.62</td>
              <td>&#8377;491,487.33</td>
              <td className="td-gain positive">+&#8377;101,323.79 (+20.62%)</td>
            </tr>
            <tr>
              <td>
                <span className="security-ticker">SMH</span>
                <span className="security-name">S&P 500 Vanguard ETF</span>
              </td>
              <td>9.0560</td>
              <td>&#8377;65,460.65</td>
              <td>&#8377;592,811.62</td>
              <td>&#8377;491,487.33</td>
              <td className="td-gain positive">+&#8377;101,323.79 (+20.62%)</td>
            </tr>
            <tr>
              <td>
                <span className="security-ticker">HDFCBANK</span>
                <span className="security-name">S&P 500 Vanguard ETF</span>
              </td>
              <td>9.0560</td>
              <td>&#8377;65,460.65</td>
              <td>&#8377;592,811.62</td>
              <td>&#8377;491,487.33</td>
              <td className="td-gain positive">+&#8377;101,323.79 (+20.62%)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HoldingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="20" height="20">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3v9l6.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 12 16" fill="none" width="10" height="14" className="sort-icon">
      <path d="M6 2l3 4H3l3-4zM6 14l-3-4h6l-3 4z" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
