import { useEffect, useState } from 'react';
import { clockIn, clockOut, recentDays, recordFor, useAttendance } from '../attendance.js';
import { useSession, useStaffRoster } from '../auth.js';
import { clockParts, dayLabel, isoDate } from '../store.js';
import { toast, showError } from '../components/dialogs.jsx';
import { PageHead, Stat, SummaryRow } from '../components/ui.jsx';
import Button from '../buttons/Button.jsx';
import ClockInButton from '../buttons/staff/ClockInButton.jsx';
import ClockOutButton from '../buttons/staff/ClockOutButton.jsx';

function StatusPill({ record, isToday }) {
    if (!record) return <span className="status-badge muted">{isToday ? 'Not in yet' : 'No record'}</span>;
    if (record.out) return <span className="status-badge completed">Done · {record.hours}h</span>;
    return <span className="status-badge processing">On duty</span>;
}

/** A wall clock that only the open page keeps ticking. */
function useTickingClock() {
    const [now, setNow] = useState(() => clockParts());
    useEffect(() => {
        const timer = setInterval(() => setNow(clockParts()), 1000);
        return () => clearInterval(timer);
    }, []);
    return now;
}

function StaffCell({ staff }) {
    return (
        <span className="staff-cell">
            <span className="admin-avatar">{staff.avatar}</span>
            <span className="staff-meta">
                <b>{staff.name}</b>
                <small>ID {staff.code}</small>
            </span>
        </span>
    );
}

/**
 * Admin view: the whole counter team on one screen - who is in, who is still
 * out, what they logged today, and a week of hours per person. The admin can
 * also clock a staff member in or out from the row if they forgot.
 */
function StaffTracker() {
    useAttendance();
    const now = useTickingClock();
    const roster = useStaffRoster();

    const today = isoDate();
    const days = recentDays(7);

    const rows = roster.map((staff) => ({ staff, record: recordFor(staff.code, today) }));
    const present = rows.filter((row) => row.record).length;
    const onDuty = rows.filter((row) => row.record && !row.record.out).length;
    const hoursToday = rows.reduce((sum, row) => sum + (Number(row.record?.hours) || 0), 0);

    const week = roster.map((staff) => {
        const worked = days
            .map((date) => ({ date, record: recordFor(staff.code, date) }))
            .filter((day) => day.record && day.record.in);

        let streak = 0;
        for (const date of days) {
            if (recordFor(staff.code, date)) streak += 1;
            else break;
        }

        return {
            staff,
            daysPresent: worked.length,
            hours: worked.reduce((sum, day) => sum + (Number(day.record.hours) || 0), 0),
            streak,
            lastIn: worked[0] ? `${dayLabel(worked[0].date)} · ${worked[0].record.in}` : '—',
        };
    });

    async function clockInStaff(staff) {
        try {
            await clockIn({ code: staff.code, name: staff.name });
            toast(`${staff.name} clocked in at ${clockParts().time} ${clockParts().period}`, 'success');
        } catch (error) {
            showError(error);
        }
    }

    async function clockOutStaff(staff) {
        try {
            const record = await clockOut(staff.code);
            if (record) toast(`${staff.name} clocked out at ${record.out} · ${record.hours}h worked`, 'success');
        } catch (error) {
            showError(error);
        }
    }

    return (
        <>
            <PageHead
                title="Staff Attendance"
                subtitle="Track when your team clocks in and out, and how many hours each one has logged."
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-person-check" label="Present Today" value={`${present} / ${roster.length}`} hint="Clocked in today" />
                <Stat tone="blue" icon="bi-briefcase" label="On Duty" value={onDuty} hint="Working right now" />
                <Stat tone="yellow" icon="bi-person-x" label="Not In Yet" value={roster.length - present} hint="No clock-in today" />
                <Stat tone="purple" icon="bi-hourglass-split" label="Hours Today" value={hoursToday} hint="Team total" />
            </SummaryRow>

            <div className="attendance-stack">
                <section className="admin-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Today&apos;s Attendance</h2>
                            <p>{dayLabel(today)} &middot; live status of every staff member</p>
                        </div>
                        <span className="attendance-time"><i className="bi bi-clock"></i> {now.time} {now.period}</span>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Staff</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Status</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {rows.length === 0 ? (
                                    <tr><td colSpan="6">No staff accounts yet.</td></tr>
                                ) : rows.map(({ staff, record }) => (
                                    <tr key={staff.code}>
                                        <td><StaffCell staff={staff} /></td>
                                        <td>{record?.in || '—'}</td>
                                        <td>{record?.out || '—'}</td>
                                        <td className="strong-cell">{record?.hours || 0}</td>
                                        <td><StatusPill record={record} isToday /></td>
                                        <td>
                                            {!record ? (
                                                <Button variant="mini" onClick={() => clockInStaff(staff)}>
                                                    <i className="bi bi-box-arrow-in-right"></i> Clock in
                                                </Button>
                                            ) : !record.out ? (
                                                <Button variant="mini" onClick={() => clockOutStaff(staff)}>
                                                    <i className="bi bi-box-arrow-right"></i> Clock out
                                                </Button>
                                            ) : (
                                                <span className="status-badge completed">Complete</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="admin-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Last 7 Days</h2>
                            <p>Hours and attendance per staff member</p>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Staff</th><th>Days Present</th><th>Total Hours</th><th>Streak</th><th>Last Clock-in</th></tr>
                            </thead>
                            <tbody>
                                {week.map((row) => (
                                    <tr key={row.staff.code}>
                                        <td><StaffCell staff={row.staff} /></td>
                                        <td>{row.daysPresent} / {days.length}</td>
                                        <td className="strong-cell">{row.hours}h</td>
                                        <td>{row.streak} day{row.streak === 1 ? '' : 's'}</td>
                                        <td>{row.lastIn}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </>
    );
}

/** Staff view: clock in / out for the signed-in cashier, plus the last seven days. */
function MyShift() {
    useAttendance();
    const session = useSession();
    const now = useTickingClock();

    const fallbackId = session?.role === 'inventory-staff' ? 'INV-000' : session?.role === 'counter-staff' ? 'CST-000' : 'ADMIN-01';
    const code = session?.username || fallbackId;
    const name = session?.name || 'Staff';
    const today = isoDate();
    const todayRecord = recordFor(code, today);

    const days = recentDays(7).map((date) => ({ date, record: recordFor(code, date) }));
    const present = days.filter((day) => day.record && day.record.in).length;
    const hours = days.reduce((sum, day) => sum + (Number(day.record?.hours) || 0), 0);
    const streak = days.filter((day, index) => (index === 0 ? Boolean(todayRecord) : Boolean(day.record))).length;

    async function handleClockIn() {
        try {
            await clockIn({ code, name });
            toast(`Clocked in at ${clockParts().time} ${clockParts().period}`, 'success');
        } catch (error) {
            showError(error);
        }
    }

    async function handleClockOut() {
        try {
            const record = await clockOut(code);
            if (record) toast(`Clocked out at ${record.out} · ${record.hours}h worked`, 'success');
        } catch (error) {
            showError(error);
        }
    }

    return (
        <>
            <PageHead
                title="Attendance"
                subtitle="Clock in when you start your shift and clock out when you finish."
            />

            <SummaryRow>
                <Stat tone="green" icon="bi-person-check" label="Days Present" value={`${present} / 7`} hint="Last seven days" />
                <Stat tone="blue" icon="bi-hourglass-split" label="Hours Logged" value={hours} hint="Last seven days" />
                <Stat tone="yellow" icon="bi-calendar-check" label="Today" value={todayRecord ? (todayRecord.out ? 'Done' : 'On duty') : 'Not in'} hint={todayRecord ? `In ${todayRecord.in}` : 'No clock-in yet'} />
                <Stat tone="purple" icon="bi-fire" label="Streak" value={streak} hint="Days in a row" />
            </SummaryRow>

            <div className="attendance-grid">
                <section className="admin-panel attendance-clock">
                    <div className="panel-heading">
                        <div>
                            <h2>Today&apos;s Shift</h2>
                            <p>{dayLabel(today)}</p>
                        </div>
                        <span className="attendance-time"><i className="bi bi-clock"></i> {now.time} {now.period}</span>
                    </div>

                    <div className="attendance-card">
                        <span className="admin-avatar large">{session?.avatar || 'ST'}</span>
                        <div className="attendance-who">
                            <b>{name}</b>
                            <small>ID {code} &middot; Cashier</small>
                            <StatusPill record={todayRecord} isToday />
                        </div>

                        <div className="attendance-actions">
                            {!todayRecord ? (
                                <ClockInButton onClick={handleClockIn} />
                            ) : !todayRecord.out ? (
                                <ClockOutButton onClick={handleClockOut} />
                            ) : (
                                <span className="attendance-done">
                                    <i className="bi bi-check2-circle"></i> Shift complete &middot; {todayRecord.hours}h
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="attendance-meta">
                        <div><span>Started</span><b>{todayRecord?.in || '—'}</b></div>
                        <div><span>Finished</span><b>{todayRecord?.out || '—'}</b></div>
                        <div><span>Hours</span><b>{todayRecord?.hours || 0}</b></div>
                    </div>
                </section>

                <section className="admin-panel">
                    <div className="panel-heading">
                        <div>
                            <h2>Last 7 Days</h2>
                            <p>Your clock-in history</p>
                        </div>
                    </div>
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr><th>Day</th><th>Date</th><th>Clock in</th><th>Clock out</th><th>Hours</th><th>Status</th></tr>
                            </thead>
                            <tbody>
                                {days.map((day) => (
                                    <tr key={day.date}>
                                        <td><b>{new Date(`${day.date}T00:00:00`).toLocaleDateString('en-PH', { weekday: 'long' })}</b></td>
                                        <td>{dayLabel(day.date)}</td>
                                        <td>{day.record?.in || '—'}</td>
                                        <td>{day.record?.out || '—'}</td>
                                        <td className="strong-cell">{day.record?.hours || 0}</td>
                                        <td><StatusPill record={day.record} isToday={day.date === today} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </>
    );
}

/** The admin tracks the team; everyone else clocks themselves in. */
export default function Attendance() {
    const session = useSession();
    return session?.role === 'admin' ? <StaffTracker /> : <MyShift />;
}
