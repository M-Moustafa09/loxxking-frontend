import { TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import { Component, OnInit, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import {
  LucideAngularModule,
  ArrowLeftRight,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Percent,
  Search,
  Settings,
  Store,
  Tag,
  Trash2,
  UserCog,
  Wallet,
  X
} from 'lucide-angular';

import { AuthService } from '../../../../core/services/auth/auth.service';
import { ToastService } from '../../../../core/services/toast/toast.service';
import { CrmMenuService, CrmMenuEntry } from '../../../../core/services/crm-menu/crm-menu.service';
import { SafeHtml } from '@angular/platform-browser';

type StaffRole = 'admin' | 'manager' | 'sales';

type StaffAccount = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  roleLabel: string;
  avatar?: string;
}

type NavChild = {
  key: string;
  label: string;
  path?: string;
  /** Set on an entry that comes from the CRM: following it leaves the store. */
  externalUrl?: string;
  iconHtml?: SafeHtml;
}

type NavItem = {
  key: string;
  label: string;
  path?: string;
  externalUrl?: string;
  icon?: any;
  iconHtml?: SafeHtml;
  adminOnly?: boolean;
  children?: NavChild[];
}

type SidebarView = 'menu' | 'accounts' | 'submenu';

const STAFF_KEY = 'loxx-dashboard-staff-accounts-v1';
const ACTIVE_KEY = 'loxx-dashboard-active-account-v1';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [TranslatePipe, TranslateDirective, CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css']
})
export class AdminLayoutComponent implements OnInit {
  @ViewChild('avatarInput') avatarInputRef!: ElementRef<HTMLInputElement>;

  /**
   * The store's own entry stays first: it is the one page this dashboard actually is, and the
   * admin came here for it. Luxira's sections follow, so the menu they use in the CRM all day is
   * the menu they get here too.
   */
  private readonly storeNavItems: NavItem[] = [
    { key: 'store-customizer', label: 'DASHBOARD.AUTO_STR_265', path: '/admin/store-customizer', icon: Store },
  ];

  navItems: NavItem[] = [...this.storeNavItems];

  pathname = '';
  
  isSidebarOpen = false;
  /** The header gear opens a small menu: add a product, or manage categories. */
  isSettingsMenuOpen = false;
  sidebarView: SidebarView = 'menu';
  activeSubmenuKey: string | null = null;
  menuSearch = '';
  accountSearch = '';
  isAvatarActionsOpen = false;
  isAvatarLoading = false;
  
  accounts: StaffAccount[] = [];
  activeAccountId = '';

  constructor(
    public router: Router,
    private authService: AuthService,
    private toastService: ToastService,
    private crmMenuService: CrmMenuService
  ) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.pathname = event.urlAfterRedirects;
    });
    this.pathname = this.router.url;
  }

  get currentRole(): StaffRole {
    const role = this.authService.user()?.role;
    if (role === 'manager' || role === 'sales') return role as StaffRole;
    return 'admin';
  }

  get currentAccount(): StaffAccount {
    const user = this.authService.user();
    return {
      id: user?.id ?? 'admin',
      name: user?.name || 'مدير النظام',
      email: user?.email || 'admin@loxxking.com',
      role: this.currentRole,
      roleLabel: this.roleLabel(this.currentRole),
      avatar: user?.avatar,
    };
  }

  get activeAccount(): StaffAccount {
    return this.accounts.find(account => account.id === this.activeAccountId) ?? this.currentAccount;
  }

  get isRootAdmin(): boolean {
    return this.currentRole === 'admin';
  }

  get activeSubmenu(): NavItem | null {
    return this.navItems.find(item => item.key === this.activeSubmenuKey && item.children?.length) ?? null;
  }

  get visibleLinks(): NavItem[] {
    const query = this.menuSearch.trim().toLowerCase();
    return this.navItems.filter(item => {
      if (item.adminOnly && !this.isRootAdmin) return false;
      if (!query) return true;
      return item.label.toLowerCase().includes(query)
        || item.children?.some(child => child.label.toLowerCase().includes(query));
    });
  }

  get visibleAccounts(): StaffAccount[] {
    const query = this.accountSearch.trim().toLowerCase();
    if (!query) return this.accounts;
    return this.accounts.filter(account =>
      account.name.toLowerCase().includes(query)
      || account.email.toLowerCase().includes(query)
    );
  }

  ngOnInit() {
    this.accounts = this.readAccounts(this.currentAccount);
    this.activeAccountId = window.localStorage.getItem(ACTIVE_KEY) || this.currentAccount.id;
    this.loadCrmMenu();
  }

  private async loadCrmMenu(): Promise<void> {
    const entries = await this.crmMenuService.load();
    this.navItems = [...this.storeNavItems, ...entries.map(entry => this.toNavItem(entry))];
  }

  private toNavItem(entry: CrmMenuEntry): NavItem {
    return {
      key: entry.key,
      label: entry.label,
      externalUrl: entry.url,
      iconHtml: entry.iconHtml,
      children: entry.children.map(child => ({
        key: child.key,
        label: child.label,
        externalUrl: child.url,
        iconHtml: child.iconHtml
      }))
    };
  }

  roleLabel(role: StaffRole): string {
    if (role === 'manager') return 'مدير';
    if (role === 'sales') return 'مسؤول مبيعات';
    return 'مدير النظام';
  }

  initials(name: string): string {
    return name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('') || 'م';
  }

  readAccounts(current: StaffAccount): StaffAccount[] {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STAFF_KEY) || '[]');
      const list = Array.isArray(parsed)
        ? parsed.filter((account): account is StaffAccount => {
            if (!account || typeof account !== 'object') return false;
            return Boolean(account.id && account.name && account.email && account.role);
          })
        : [];

      if (!list.some(account => account.id === current.id || account.email === current.email)) {
        list.unshift(current);
      }

      window.localStorage.setItem(STAFF_KEY, JSON.stringify(list));
      return list;
    } catch {
      return [current];
    }
  }

  readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('SHARED.AUTO_STR_36'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  isRouteActive(pathname: string, path?: string): boolean {
    // A CRM entry has no route of its own. Without this an empty path matched every url, so every
    // one of them drew itself as the current page.
    if (!path) return false;
    if (path === '/admin') return pathname === '/admin' || pathname === '/admin/';
    return pathname === path || pathname.startsWith(`${path}/`);
  }

  openSettingsItem(path: string): void {
    this.isSettingsMenuOpen = false;
    this.router.navigateByUrl(path);
  }

  closeSidebar(): void {
    this.isSidebarOpen = false;
    this.sidebarView = 'menu';
    this.activeSubmenuKey = null;
    this.menuSearch = '';
    this.accountSearch = '';
    this.isAvatarActionsOpen = false;
  }

  openPage(path: string): void {
    this.closeSidebar();
    this.router.navigateByUrl(path);
  }

  /**
   * One handler for both kinds of entry. A CRM entry is a full page load on luxira.org — the admin
   * is meant to land back in the CRM, and the SSO session they arrived with is still waiting there.
   */
  openEntry(item: NavItem | NavChild): void {
    if (item.externalUrl) {
      this.closeSidebar();
      window.location.href = item.externalUrl;
      return;
    }

    if (item.path) this.openPage(item.path);
  }

  openAccounts(): void {
    this.sidebarView = 'accounts';
    this.accountSearch = '';
  }

  openSubmenu(itemKey: string): void {
    this.activeSubmenuKey = itemKey;
    this.sidebarView = 'submenu';
    this.menuSearch = '';
  }

  returnToMainMenu(): void {
    this.sidebarView = 'menu';
    this.activeSubmenuKey = null;
  }

  chooseAccount(account: StaffAccount): void {
    this.activeAccountId = account.id;
    window.localStorage.setItem(ACTIVE_KEY, account.id);
    this.sidebarView = 'menu';
    this.toastService.showToast(`تم الانتقال إلى حساب ${account.name}`, 'success');
  }

  async handleAvatarChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.toastService.showToast('SHARED.AUTO_STR_23', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.toastService.showToast('SHARED.AUTO_STR_6', 'error');
      return;
    }

    try {
      this.isAvatarLoading = true;
      const avatar = await this.readFileAsDataUrl(file);
      this.accounts = this.accounts.map(account =>
        account.id === this.activeAccount.id ? { ...account, avatar } : account
      );
      window.localStorage.setItem(STAFF_KEY, JSON.stringify(this.accounts));
      this.isAvatarActionsOpen = false;
      this.toastService.showToast('SHARED.AUTO_STR_24', 'success');
    } catch (error) {
      this.toastService.showToast(error instanceof Error ? error.message : 'SHARED.AUTO_STR_44', 'error');
    } finally {
      this.isAvatarLoading = false;
    }
  }

  removeAvatar(): void {
    this.accounts = this.accounts.map(account =>
      account.id === this.activeAccount.id ? { ...account, avatar: undefined } : account
    );
    window.localStorage.setItem(STAFF_KEY, JSON.stringify(this.accounts));
    this.isAvatarActionsOpen = false;
    this.toastService.showToast('SHARED.AUTO_STR_30', 'info');
  }

  logout(): void {
    this.authService.setUser(null);
    this.closeSidebar();
    this.router.navigate(['/'], { replaceUrl: true });
  }

  updateMenuSearch(event: Event): void {
    this.menuSearch = (event.target as HTMLInputElement).value;
  }

  updateAccountSearch(event: Event): void {
    this.accountSearch = (event.target as HTMLInputElement).value;
  }

  readonly ArrowLeftRightIcon = ArrowLeftRight;
  readonly CameraIcon = Camera;
  readonly CheckCircle2Icon = CheckCircle2;
  readonly ChevronLeftIcon = ChevronLeft;
  readonly ChevronRightIcon = ChevronRight;
  readonly DatabaseIcon = Database;
  readonly LayoutDashboardIcon = LayoutDashboard;
  readonly LogOutIcon = LogOut;
  readonly MenuIcon = Menu;
  readonly PackageIcon = Package;
  readonly PercentIcon = Percent;
  readonly SearchIcon = Search;
  readonly SettingsIcon = Settings;
  readonly StoreIcon = Store;
  readonly TagIcon = Tag;
  readonly Trash2Icon = Trash2;
  readonly UserCogIcon = UserCog;
  readonly WalletIcon = Wallet;
  readonly XIcon = X;
}
