import type { Request, Response } from "express"
import User from "../models/User"
import { checkPassword, hashPassword } from "../utils/auth"
import Token from "../models/Token"
import { generateToken } from "../utils/token"
import { AuthEmail } from "../emails/AuthEmail"
import { generateJWT } from "../utils/jwt"

export class AuthController {

    static createAccount = async (req: Request, res: Response) => {
        try {
            const {password, email} = req.body
            // Prevenir usuarios duplicados
            const userExist = await User.findOne({email})
            if(userExist){
                const error = new Error('El usuario ya esta registrado')
                return res.status(409).json({error: error.message})
            }

            // Crea el usuario
            const user = new User(req.body)
            
            // Hash Password
            user.password = await hashPassword(password)

            // Generar Token
            const token = new Token()
            token.token = generateToken()
            token.user = user.id

            // Enviar Email
            AuthEmail.sendConfirmationEmail({
                email: user.email,
                name: user.name,
                token: token.token
            })

            await Promise.allSettled([user.save(), token.save()])

            res.send('Cuenta creada, revisa tu email para confirmar')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static confirmAccount = async (req: Request, res: Response) => {
        try {
            const { token } = req.body

            const tokenExist = await Token.findOne({token})
            if(!tokenExist) {
                const error = new Error('Token no válido')
                return res.status(404).json({error: error.message})
            }
            const user = await User.findById(tokenExist.user)
            user.confirmed = true

            await Promise.allSettled([
                user.save(),
                tokenExist.deleteOne()
            ])

            res.send('Cuenta confirmada correctamente')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body
            const user = await User.findOne({email})
            if(!user) {
                const error = new Error('Usuario no encontrado')
                return res.status(404).json({error: error.message})
            }

            if(!user.confirmed){
                const token = new Token()
                token.user = user.id
                token.token = generateToken()
                await token.save()

                // Enviar Email
                AuthEmail.sendConfirmationEmail({
                    email: user.email,
                    name: user.name,
                    token: token.token
                })

                const error = new Error('La cuenta no a sido confirmada hemos enviado un e-mail de confirmación')
                return res.status(401).json({error: error.message})
            }

            // Validar Password
            const isPasswordCorrect = await checkPassword(password, user.password)
            if(!isPasswordCorrect){
                const error = new Error('El Password es incorrecto')
                return res.status(401).json({error: error.message})
            }

            const token = generateJWT({id: user.id})

            res.send(token)
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static requestConfirmationCode = async (req: Request, res: Response) => {
        try {
            const {email} = req.body

            // usuario existe
            const user = await User.findOne({email})
            if(!user){
                const error = new Error('El usuario no esta registrado')
                return res.status(404).json({error: error.message})
            }

            if(user.confirmed){
                const error = new Error('El usuario ya esta confirmado')
                return res.status(403).json({error: error.message})
            }

            // Generar Token
            const token = new Token()
            token.token = generateToken()
            token.user = user.id

            // Enviar Email
            AuthEmail.sendConfirmationEmail({
                email: user.email,
                name: user.name,
                token: token.token
            })

            await Promise.allSettled([user.save(), token.save()])

            res.send('Se envio un nuevo Token a tu Email')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static forgotPassword = async (req: Request, res: Response) => {
        try {
            const {email} = req.body

            // usuario existe
            const user = await User.findOne({email})
            if(!user){
                const error = new Error('El usuario no esta registrado')
                return res.status(404).json({error: error.message})
            }

            // Generar Token
            const token = new Token()
            token.token = generateToken()
            token.user = user.id
            await token.save()

            // Enviar Email
            AuthEmail.sendPasswordResetToken({
                email: user.email,
                name: user.name,
                token: token.token
            })

            res.send('Revisa tu email para instrucciones')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static validateToken = async (req: Request, res: Response) => {
        try {
            const { token } = req.body

            const tokenExist = await Token.findOne({token})
            if(!tokenExist) {
                const error = new Error('Token no válido')
                return res.status(404).json({error: error.message})
            }

            res.send('Token valido, define tu nuevo password')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static updatePasswordWithToken = async (req: Request, res: Response) => {
        try {
            const { token } = req.params

            const tokenExist = await Token.findOne({token})
            if(!tokenExist) {
                const error = new Error('Token no válido')
                return res.status(404).json({error: error.message})
            }

            const user = await User.findById(tokenExist.user)
            user.password = await hashPassword(req.body.password)

            await Promise.allSettled([user.save(), tokenExist.deleteOne()])

            res.send('Passwor modificado correctamente')
        } catch (error) {
            res.status(500).json({error: 'Hubo un error'})
        }
    }
    static user = async (req: Request, res: Response) => {
        return res.json(req.user)
    }
    static updateProfile = async (req: Request, res: Response) => {
        const { name, email } = req.body

        const userExist = await User.findOne({email})
        if(userExist && userExist.id.toString() !== req.user.id.toString()) {
            const error = new Error('Ese email ya esta registrado')
            return res.status(409).json({error: error.message})
        }

        req.user.name = name
        req.user.email = email

        try {
            await req.user.save()
            res.send('Perfil actualizado correctamente')
        } catch (error) {
            res.status(500).send('Hubo un error')
        }
    }
    static updateCurrentUserPassword = async (req: Request, res: Response) => {
        const { current_password, password } = req.body

        const user = await User.findById(req.user.id)

        const isPasswordCurrent = await checkPassword(current_password, user.password)
        if(!isPasswordCurrent) {
            const error = new Error('El password actual es incorrecto')
            return res.status(401).json({error: error.message})
        }
        
        try {
            user.password = await hashPassword(password)
            await user.save()
            res.send('El password se modifico correctamente')
            
        } catch (error) {
            res.status(500).send('Hubo un error')
        }
    }
    static checkPassword = async (req: Request, res: Response) => {
        const { password } = req.body

        const user = await User.findById(req.user.id)

        const isPasswordCurrent = await checkPassword(password, user.password)
        if(!isPasswordCurrent) {
            const error = new Error('El password es incorrecto')
            return res.status(401).json({error: error.message})
        }
        
        res.send('Password Correcto')
    }
}