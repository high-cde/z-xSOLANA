// SPDX-License-Identifier: LicenseRef-ZSEL-Proprietary
// Velvet Pay (VPAY) · versione di TEST per Polygon Amoy (chainId 80002). ZDOS1.3.
// ERC-20 a 18 decimali, stesso formato di $DSN NETkali su Polygon. Non ha valore. Rifiuta il deploy fuori da Amoy.
pragma solidity 0.8.28;

contract VelvetPayTest {
    string public constant name = "Velvet Pay (TEST Amoy)";
    string public constant symbol = "VPAY";
    uint8 public constant decimals = 18;
    uint256 public totalSupply;
    address public owner;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    error SoloAmoy();
    error SoloOwner();
    error SaldoInsufficiente();
    error AllowanceInsufficiente();
    error IndirizzoZero();

    constructor(uint256 initialSupply) {
        if (block.chainid != 80002) revert SoloAmoy();
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
        _mint(msg.sender, initialSupply);
    }

    modifier onlyOwner() { if (msg.sender != owner) revert SoloOwner(); _; }

    function transfer(address to, uint256 value) external returns (bool) { _transfer(msg.sender, to, value); return true; }

    function approve(address spender, uint256 value) external returns (bool) {
        if (spender == address(0)) revert IndirizzoZero();
        allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 a = allowance[from][msg.sender];
        if (a != type(uint256).max) { if (a < value) revert AllowanceInsufficiente(); unchecked { allowance[from][msg.sender] = a - value; } }
        _transfer(from, to, value); return true;
    }

    /// Solo per il faucet di test della galleria zNFT.
    function mint(address to, uint256 value) external onlyOwner { _mint(to, value); }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert IndirizzoZero();
        emit OwnershipTransferred(owner, newOwner); owner = newOwner;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert IndirizzoZero();
        uint256 b = balanceOf[from]; if (b < value) revert SaldoInsufficiente();
        unchecked { balanceOf[from] = b - value; balanceOf[to] += value; }
        emit Transfer(from, to, value);
    }

    function _mint(address to, uint256 value) internal {
        if (to == address(0)) revert IndirizzoZero();
        totalSupply += value; balanceOf[to] += value; emit Transfer(address(0), to, value);
    }
}
