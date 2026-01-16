// SPDX-License-Identifier: MIT
// DynamicFxOracle.cairo — Oracle dinámico TOKEN↔ARS (Cairo 1)
// - Owner setea precio exacto en ARS por 1 TOKEN (address del token).
// - Lee `decimals()` del token y usa esa escala para cotizar ARS→TOKEN (base units).
// - Expuesto (solo lectura para terceros):
//     get_token_price_in_ars(token) -> u256
//     get_quote_ars_to_token(token, amount_ars: u256) -> u256
// - Admin (owner):
//     set_quote_token_to_ars(token, price_ars_per_token)
//     pause/unpause/transfer_admin

#[starknet::interface]
pub trait IERC20Metadata<TContractState> {
    fn decimals(self: @TContractState) -> u8;
}

#[starknet::interface]
pub trait IDynamicFxOracle<TContractState> {
    // Lecturas
    fn is_active(self: @TContractState) -> bool;
    fn last_updated(self: @TContractState) -> u64;
    fn get_admin(self: @TContractState) -> felt252;

    fn get_token_price_in_ars(self: @TContractState, token: felt252) -> u256;
    fn get_quote_ars_to_token(self: @TContractState, token: felt252, amount_ars: u256) -> u256;

    // Admin
    fn set_quote_token_to_ars(ref self: TContractState, token: felt252, price_ars_per_token: u256);
    fn pause(ref self: TContractState);
    fn unpause(ref self: TContractState);
    fn transfer_admin(ref self: TContractState, new_admin: felt252);
}

#[starknet::contract]
mod DynamicFxOracle {
    use starknet::get_caller_address;
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess};

    // Dispatcher para leer metadata del token
    use super::IERC20MetadataDispatcher;
    use super::IERC20MetadataDispatcherTrait;

    #[storage]
    struct Storage {
        admin: felt252,
        _active: bool,
        _last_updated: u64,

        // ARS por 1 TOKEN (unidad humana, entero u256)
        price_ars_per_token: Map<felt252, u256>,
        // Cache de decimales
        token_decimals: Map<felt252, u8>,
        // Flag de precio seteado
        has_price: Map<felt252, bool>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        PriceUpdated: PriceUpdated,
        Paused: Paused,
        Unpaused: Unpaused,
        AdminTransferred: AdminTransferred,
    }

    #[derive(Drop, starknet::Event)]
    struct PriceUpdated { token: felt252, old_price: u256, new_price: u256, decimals: u8, timestamp: u64 }
    #[derive(Drop, starknet::Event)]
    struct Paused { admin: felt252, timestamp: u64 }
    #[derive(Drop, starknet::Event)]
    struct Unpaused { admin: felt252, timestamp: u64 }
    #[derive(Drop, starknet::Event)]
    struct AdminTransferred { old_admin: felt252, new_admin: felt252, timestamp: u64 }

    #[constructor]
    fn constructor(ref self: ContractState, admin: felt252) {
        assert(admin != 0, 'admin=0');
        self.admin.write(admin);
        self._active.write(true);
        self._last_updated.write(starknet::get_block_timestamp());
    }

    #[abi(embed_v0)]
    impl OracleImpl of super::IDynamicFxOracle<ContractState> {
        // --- Lecturas ---
        fn is_active(self: @ContractState) -> bool { self._active.read() }
        fn last_updated(self: @ContractState) -> u64 { self._last_updated.read() }
        fn get_admin(self: @ContractState) -> felt252 { self.admin.read() }

        fn get_token_price_in_ars(self: @ContractState, token: felt252) -> u256 {
            assert(self.has_price.read(token), 'price not set');
            self.price_ars_per_token.read(token)
        }

        fn get_quote_ars_to_token(self: @ContractState, token: felt252, amount_ars: u256) -> u256 {
            assert(self._active.read(), 'oracle paused');
            assert(self.has_price.read(token), 'price not set');
            assert(amount_ars > 0, 'amount=0');

            let dec: u8 = self.token_decimals.read(token);
            let scale: u256 = pow10_u256(dec);
            let price: u256 = self.price_ars_per_token.read(token);

            // token_base = amount_ars * 10^dec / price (floor)
            let num: u256 = amount_ars * scale;
            let q: u256 = num / price;
            q
        }

        // --- Admin ---
        fn set_quote_token_to_ars(ref self: ContractState, token: felt252, price_ars_per_token: u256) {
            let caller: felt252 = get_caller_address().into();
            assert(caller == self.admin.read(), 'only admin');
            assert(token != 0, 'token=0');
            assert(price_ars_per_token > 0, 'price=0');

            // Leer decimales desde el token
            let meta = super::IERC20MetadataDispatcher { contract_address: token.try_into().unwrap() };
            let dec: u8 = meta.decimals();

            let old: u256 = if self.has_price.read(token) { self.price_ars_per_token.read(token) } else { 0.into() };
            self.price_ars_per_token.write(token, price_ars_per_token);
            self.token_decimals.write(token, dec);
            self.has_price.write(token, true);

            let ts = starknet::get_block_timestamp();
            self._last_updated.write(ts);
            self.emit(Event::PriceUpdated(PriceUpdated{
                token, old_price: old, new_price: price_ars_per_token, decimals: dec, timestamp: ts
            }));
        }

        fn pause(ref self: ContractState) {
            let caller: felt252 = get_caller_address().into();
            assert(caller == self.admin.read(), 'only admin');
            assert(self._active.read(), 'already paused');
            self._active.write(false);
            let ts = starknet::get_block_timestamp();
            self._last_updated.write(ts);
            self.emit(Event::Paused(Paused { admin: caller, timestamp: ts }));
        }

        fn unpause(ref self: ContractState) {
            let caller: felt252 = get_caller_address().into();
            assert(caller == self.admin.read(), 'only admin');
            assert(!self._active.read(), 'already active');
            self._active.write(true);
            let ts = starknet::get_block_timestamp();
            self._last_updated.write(ts);
            self.emit(Event::Unpaused(Unpaused { admin: caller, timestamp: ts }));
        }

        fn transfer_admin(ref self: ContractState, new_admin: felt252) {
            let caller: felt252 = get_caller_address().into();
            assert(caller == self.admin.read(), 'only admin');
            assert(new_admin != 0, 'new admin=0');
            let old = self.admin.read();
            self.admin.write(new_admin);
            let ts = starknet::get_block_timestamp();
            self._last_updated.write(ts);
            self.emit(Event::AdminTransferred(AdminTransferred { old_admin: old, new_admin, timestamp: ts }));
        }
    }

    // --- Utils ---
    fn pow10_u256(dec: u8) -> u256 {
        let mut i: u8 = 0_u8;
        let mut acc: u256 = 1_u128.into();
        loop {
            if i == dec { break; }
            acc = acc * 10_u128.into();
            i = i + 1_u8;
        };
        acc
    }
}
